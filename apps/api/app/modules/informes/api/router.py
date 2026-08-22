from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.infrastructure.models import (
    AperturaCaja,
    Articulo,
    ArticuloProveedor,
    CajaVenta,
    CobroDocumento,
    CobroMedioPago,
    CodigoBarraArticulo,
    FacturaCompra,
    ImputacionCobroVenta,
    NotaCredito,
    NotaCreditoDetalle,
    PuntoVenta,
    Socio,
    VentaDocumento,
    VentaDocumentoDetalle,
)
from app.modules.tesoreria.infrastructure.models import (
    ImputacionPagoFactura,
    MovimientoCaja,
    PagoDocumento,
    PagoMedioPago,
)
from app.modules.usuarios.api.dependencias import requerir_permiso
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/informes", tags=["Informes"])


def rango(desde: date | None, hasta: date | None) -> tuple[datetime, datetime]:
    fin = hasta or datetime.now(UTC).date()
    inicio = desde or (fin - timedelta(days=29))
    return (
        datetime.combine(inicio, time.min, tzinfo=UTC),
        datetime.combine(fin + timedelta(days=1), time.min, tzinfo=UTC),
    )


def importe(valor: Decimal | int | None) -> Decimal:
    return Decimal(valor or 0).quantize(Decimal("0.01"))


@router.get("/filtros/clientes", dependencies=[Depends(requerir_permiso("informes.ver"))])
async def buscar_clientes_informe(
    buscar: str = Query(default="", max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[dict]:
    consulta = select(Socio).where(Socio.es_cliente.is_(True), Socio.activo.is_(True))
    for termino in buscar.split():
        patron = f"%{termino}%"
        consulta = consulta.where(
            or_(
                Socio.codigo.ilike(patron),
                Socio.razon_social.ilike(patron),
                Socio.nombre_fantasia.ilike(patron),
                Socio.numero_documento.ilike(patron),
            )
        )
    clientes = list(await sesion.scalars(consulta.order_by(Socio.razon_social).limit(20)))
    return [
        {
            "id": cliente.id,
            "codigo": cliente.codigo,
            "razon_social": cliente.razon_social,
            "numero_documento": cliente.numero_documento,
        }
        for cliente in clientes
    ]


@router.get("/filtros/articulos", dependencies=[Depends(requerir_permiso("informes.ver"))])
async def buscar_articulos_informe(
    buscar: str = Query(default="", max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[dict]:
    consulta = select(Articulo).where(Articulo.habilitado.is_(True))
    for termino in buscar.split():
        patron = f"%{termino}%"
        consulta = consulta.where(
            or_(
                Articulo.codigo.ilike(patron),
                Articulo.descripcion.ilike(patron),
                Articulo.descripcion_ampliada.ilike(patron),
                select(CodigoBarraArticulo.id)
                .where(
                    CodigoBarraArticulo.articulo_id == Articulo.id,
                    CodigoBarraArticulo.codigo.ilike(patron),
                    CodigoBarraArticulo.activo.is_(True),
                )
                .exists(),
                select(ArticuloProveedor.id)
                .where(
                    ArticuloProveedor.articulo_id == Articulo.id,
                    ArticuloProveedor.codigo_proveedor.ilike(patron),
                    ArticuloProveedor.activo.is_(True),
                )
                .exists(),
            )
        )
    articulos = list(await sesion.scalars(consulta.order_by(Articulo.codigo).limit(20)))
    return [
        {"id": articulo.id, "codigo": articulo.codigo, "descripcion": articulo.descripcion}
        for articulo in articulos
    ]


@router.get("/flujo-dinero", dependencies=[Depends(requerir_permiso("informes.ver"))])
async def flujo_dinero(
    desde: date | None = None,
    hasta: date | None = None,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    inicio, fin = rango(desde, hasta)
    cobros = (
        await sesion.execute(
            select(CobroDocumento, CobroMedioPago)
            .join(CobroMedioPago, CobroMedioPago.cobro_id == CobroDocumento.id)
            .where(
                CobroDocumento.estado == "CONFIRMADO",
                CobroMedioPago.medio.notin_(("NOTA_CREDITO", "DEVOLUCION_NC")),
                CobroDocumento.fecha_realizacion >= inicio,
                CobroDocumento.fecha_realizacion < fin,
            )
        )
    ).all()
    pagos = (
        await sesion.execute(
            select(PagoDocumento, PagoMedioPago)
            .join(PagoMedioPago, PagoMedioPago.pago_id == PagoDocumento.id)
            .where(
                PagoDocumento.estado == "CONFIRMADO",
                PagoMedioPago.medio != "NOTA_CREDITO",
                PagoDocumento.fecha_realizacion >= inicio,
                PagoDocumento.fecha_realizacion < fin,
            )
        )
    ).all()
    movimientos = list(
        await sesion.scalars(
            select(MovimientoCaja).where(
                MovimientoCaja.estado == "CONFIRMADO",
                MovimientoCaja.fecha_realizacion >= inicio,
                MovimientoCaja.fecha_realizacion < fin,
            )
        )
    )
    documentos = [x[0] for x in cobros] + [x[0] for x in pagos] + movimientos
    usuarios = (
        {
            x.id: x.nombre_usuario
            for x in await sesion.scalars(
                select(Usuario).where(Usuario.id.in_({x.usuario_id for x in documentos}))
            )
        }
        if documentos
        else {}
    )
    apertura_ids = {x.apertura_caja_id for x in documentos if x.apertura_caja_id}
    contextos_caja = {}
    if apertura_ids:
        contextos_caja = {
            apertura.id: {
                "apertura_id": str(apertura.id),
                "caja": f"{caja.codigo} - {caja.descripcion}",
                "punto_venta": f"{punto.codigo} - {punto.descripcion}",
                "periodo_operativo": apertura.periodo_operativo,
            }
            for apertura, caja, punto in (
                await sesion.execute(
                    select(AperturaCaja, CajaVenta, PuntoVenta)
                    .join(CajaVenta, CajaVenta.id == AperturaCaja.caja_id)
                    .join(PuntoVenta, PuntoVenta.id == CajaVenta.punto_venta_id)
                    .where(AperturaCaja.id.in_(apertura_ids))
                )
            ).all()
        }
    socio_ids = (
        {x.cliente_id for x, _ in cobros}
        | {x.proveedor_id for x, _ in pagos}
        | {x.proveedor_id for x in movimientos if x.proveedor_id}
    )
    socios = (
        {x.id: x for x in await sesion.scalars(select(Socio).where(Socio.id.in_(socio_ids)))}
        if socio_ids
        else {}
    )
    relaciones_cobros: dict[UUID, list[dict]] = {}
    cobro_ids = {x.id for x, _ in cobros}
    if cobro_ids:
        for imputacion, venta in (
            await sesion.execute(
                select(ImputacionCobroVenta, VentaDocumento)
                .join(VentaDocumento, VentaDocumento.id == ImputacionCobroVenta.venta_id)
                .where(
                    ImputacionCobroVenta.cobro_id.in_(cobro_ids),
                    ImputacionCobroVenta.estado == "ACTIVA",
                )
            )
        ).all():
            relaciones_cobros.setdefault(imputacion.cobro_id, []).append(
                {
                    "tipo": "VENTA",
                    "id": str(venta.id),
                    "comprobante": f"{venta.letra} #{venta.numero}",
                    "importe": imputacion.importe,
                }
            )
    relaciones_pagos: dict[UUID, list[dict]] = {}
    pago_ids = {x.id for x, _ in pagos}
    if pago_ids:
        for imputacion, factura in (
            await sesion.execute(
                select(ImputacionPagoFactura, FacturaCompra)
                .join(FacturaCompra, FacturaCompra.id == ImputacionPagoFactura.factura_id)
                .where(
                    ImputacionPagoFactura.pago_id.in_(pago_ids),
                    ImputacionPagoFactura.estado == "ACTIVA",
                )
            )
        ).all():
            relaciones_pagos.setdefault(imputacion.pago_id, []).append(
                {
                    "tipo": "FACTURA_COMPRA",
                    "id": str(factura.id),
                    "comprobante": factura.comprobante_proveedor,
                    "importe": imputacion.importe,
                }
            )

    def contexto(documento) -> dict:
        return contextos_caja.get(
            documento.apertura_caja_id,
            {
                "apertura_id": None,
                "caja": "SIN CAJA",
                "punto_venta": "—",
                "periodo_operativo": None,
            },
        )

    filas = (
        [
            {
                "fecha": c.fecha_realizacion,
                "sentido": "INGRESO",
                "origen": f"COBRO #{c.numero}",
                "medio": m.medio,
                "concepto": m.referencia or "Cobro de cliente",
                "importe": m.importe,
                "id": str(c.id),
                "tipo_origen": "COBRO_CLIENTE",
                "usuario": usuarios.get(c.usuario_id, "—"),
                "socio_id": str(c.cliente_id),
                "socio": socios[c.cliente_id].razon_social if c.cliente_id in socios else "—",
                "categoria": "COBRO_CLIENTE",
                "referencia": m.referencia,
                "relaciones": relaciones_cobros.get(c.id, []),
                **contexto(c),
            }
            for c, m in cobros
        ]
        + [
            {
                "fecha": p.fecha_realizacion,
                "sentido": "EGRESO",
                "origen": f"PAGO #{p.numero}",
                "medio": m.medio,
                "concepto": m.referencia or p.observacion or "Pago a proveedor",
                "importe": m.importe,
                "id": str(p.id),
                "tipo_origen": "PAGO_PROVEEDOR",
                "usuario": usuarios.get(p.usuario_id, "—"),
                "socio_id": str(p.proveedor_id),
                "socio": socios[p.proveedor_id].razon_social if p.proveedor_id in socios else "—",
                "categoria": "PAGO_PROVEEDOR",
                "referencia": m.referencia,
                "relaciones": relaciones_pagos.get(p.id, []),
                **contexto(p),
            }
            for p, m in pagos
        ]
        + [
            {
                "fecha": m.fecha_realizacion,
                "sentido": m.tipo,
                "origen": "GASTO DIRECTO"
                if m.categoria == "GASTO_DIRECTO"
                else "MOVIMIENTO DE CAJA",
                "medio": m.medio,
                "concepto": m.concepto,
                "importe": m.importe,
                "id": str(m.id),
                "tipo_origen": "MOVIMIENTO_CAJA",
                "usuario": usuarios.get(m.usuario_id, "—"),
                "socio_id": str(m.proveedor_id) if m.proveedor_id else None,
                "socio": socios[m.proveedor_id].razon_social if m.proveedor_id in socios else None,
                "categoria": m.categoria,
                "referencia": m.referencia,
                "relaciones": [],
                **contexto(m),
            }
            for m in movimientos
        ]
    )
    filas.sort(key=lambda x: x["fecha"])
    ingresos = importe(sum((x["importe"] for x in filas if x["sentido"] == "INGRESO"), Decimal(0)))
    egresos = importe(sum((x["importe"] for x in filas if x["sentido"] == "EGRESO"), Decimal(0)))
    return {
        "desde": inicio.date(),
        "hasta": (fin - timedelta(days=1)).date(),
        "ingresos": ingresos,
        "egresos": egresos,
        "flujo_neto": ingresos - egresos,
        "movimientos": filas,
    }


@router.get("/ventas-margenes", dependencies=[Depends(requerir_permiso("informes.ver"))])
async def ventas_margenes(
    desde: date | None = None,
    hasta: date | None = None,
    cliente_id: UUID | None = None,
    articulo_id: UUID | None = None,
    limite: int = Query(500, ge=1, le=1000),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    inicio, fin = rango(desde, hasta)
    costo = func.coalesce(
        func.sum(VentaDocumentoDetalle.cantidad_base * VentaDocumentoDetalle.costo_unitario_bruto),
        0,
    )
    detalle_filtro = aliased(VentaDocumentoDetalle)
    cantidad_articulos = func.count(func.distinct(VentaDocumentoDetalle.articulo_id))
    consulta = (
        select(
            VentaDocumento,
            Socio,
            PuntoVenta,
            CajaVenta,
            costo.label("costo"),
            cantidad_articulos.label("cantidad_articulos"),
        )
        .join(Socio, Socio.id == VentaDocumento.cliente_id)
        .join(VentaDocumentoDetalle, VentaDocumentoDetalle.venta_id == VentaDocumento.id)
        .outerjoin(PuntoVenta, PuntoVenta.id == VentaDocumento.punto_venta_id)
        .outerjoin(CajaVenta, CajaVenta.id == VentaDocumento.caja_id)
        .where(
            VentaDocumento.estado == "CONFIRMADO",
            VentaDocumento.fecha_realizacion >= inicio,
            VentaDocumento.fecha_realizacion < fin,
        )
        .group_by(VentaDocumento.id, Socio.id, PuntoVenta.id, CajaVenta.id)
        .order_by(VentaDocumento.fecha_realizacion)
        .limit(limite)
    )
    if cliente_id:
        consulta = consulta.where(VentaDocumento.cliente_id == cliente_id)
    if articulo_id:
        consulta = consulta.where(
            select(detalle_filtro.id)
            .where(
                detalle_filtro.venta_id == VentaDocumento.id,
                detalle_filtro.articulo_id == articulo_id,
            )
            .exists()
        )
    filas = (await sesion.execute(consulta)).all()
    ventas = []
    documentos = []
    for venta, socio, punto, caja, costo_bruto, cantidad_items in filas:
        notas = list(
            await sesion.scalars(
                select(NotaCredito)
                .where(
                    NotaCredito.venta_id == venta.id,
                    NotaCredito.tipo == "CLIENTE",
                    NotaCredito.estado == "CONFIRMADO",
                )
                .order_by(NotaCredito.fecha_realizacion, NotaCredito.numero)
            )
        )
        costos_notas: dict[UUID, Decimal] = {}
        for nota in notas:
            costos_notas[nota.id] = importe(
                await sesion.scalar(
                    select(
                        func.coalesce(
                            func.sum(
                                NotaCreditoDetalle.cantidad_base
                                * VentaDocumentoDetalle.costo_unitario_bruto
                            ),
                            0,
                        )
                    )
                    .join(
                        VentaDocumentoDetalle,
                        VentaDocumentoDetalle.id == NotaCreditoDetalle.venta_detalle_id,
                    )
                    .where(NotaCreditoDetalle.nota_credito_id == nota.id)
                )
            )
        credito = importe(sum((nota.total_bruto for nota in notas), Decimal(0)))
        costo_devuelto = importe(sum(costos_notas.values(), Decimal(0)))
        venta_original = importe(venta.total_bruto)
        costo_original = importe(Decimal(costo_bruto))
        total = importe(venta_original - credito)
        costo_total = importe(costo_original - costo_devuelto)
        margen = total - costo_total
        comprobante = (
            f"{venta.letra} {punto.codigo}-{venta.numero or 0:08d}"
            if punto
            else f"{venta.letra} {venta.numero or 0:08d}"
        )
        punto_texto = f"{punto.codigo} - {punto.descripcion}" if punto else "SIN PUNTO"
        caja_texto = f"{caja.codigo} - {caja.descripcion}" if caja else "SIN CAJA"
        documentos.append(
            {
                "id": f"FACTURA:{venta.id}",
                "tipo": "FACTURA",
                "fecha": venta.fecha_realizacion,
                "comprobante": comprobante,
                "documento_origen": None,
                "cliente": socio.razon_social,
                "punto_venta": punto_texto,
                "caja": caja_texto,
                "modalidad": "PRODUCTOS",
                "motivo": None,
                "importe": venta_original,
                "costo": costo_original,
                "margen": venta_original - costo_original,
                "margen_porcentual": importe(
                    ((venta_original - costo_original) / venta_original * 100)
                    if venta_original
                    else 0
                ),
            }
        )
        for nota in notas:
            if not (inicio <= nota.fecha_realizacion < fin):
                continue
            costo_nota = costos_notas[nota.id]
            importe_nota = -importe(nota.total_bruto)
            costo_nota_firmado = -costo_nota
            documentos.append(
                {
                    "id": f"NOTA_CREDITO:{nota.id}",
                    "tipo": "NOTA_CREDITO",
                    "fecha": nota.fecha_realizacion,
                    "comprobante": f"NC {nota.numero:08d}",
                    "documento_origen": comprobante,
                    "cliente": socio.razon_social,
                    "punto_venta": punto_texto,
                    "caja": caja_texto,
                    "modalidad": nota.modalidad,
                    "motivo": nota.motivo,
                    "importe": importe_nota,
                    "costo": costo_nota_firmado,
                    "margen": importe_nota - costo_nota_firmado,
                    "margen_porcentual": importe(
                        ((importe_nota - costo_nota_firmado) / importe_nota * 100)
                        if importe_nota
                        else 0
                    ),
                }
            )
        ventas.append(
            {
                "id": venta.id,
                "fecha": venta.fecha_realizacion,
                "comprobante": comprobante,
                "cliente_id": socio.id,
                "cliente": socio.razon_social,
                "punto_venta": punto_texto,
                "caja": caja_texto,
                "cantidad_articulos": cantidad_items,
                "venta_original": venta_original,
                "venta_bruta": total,
                "notas_credito": credito,
                "costo_bruto": costo_total,
                "margen_bruto": margen,
                "margen_porcentual": importe((margen / total * 100) if total else 0),
            }
        )
    notas_periodo_consulta = (
        select(NotaCredito, VentaDocumento, Socio, PuntoVenta, CajaVenta)
        .join(VentaDocumento, VentaDocumento.id == NotaCredito.venta_id)
        .join(Socio, Socio.id == NotaCredito.socio_id)
        .outerjoin(PuntoVenta, PuntoVenta.id == VentaDocumento.punto_venta_id)
        .outerjoin(CajaVenta, CajaVenta.id == VentaDocumento.caja_id)
        .where(
            NotaCredito.tipo == "CLIENTE",
            NotaCredito.estado == "CONFIRMADO",
            NotaCredito.fecha_realizacion >= inicio,
            NotaCredito.fecha_realizacion < fin,
        )
        .order_by(NotaCredito.fecha_realizacion, NotaCredito.numero)
        .limit(limite)
    )
    if cliente_id:
        notas_periodo_consulta = notas_periodo_consulta.where(NotaCredito.socio_id == cliente_id)
    if articulo_id:
        detalle_nota_filtro = aliased(VentaDocumentoDetalle)
        notas_periodo_consulta = notas_periodo_consulta.where(
            select(detalle_nota_filtro.id)
            .where(
                detalle_nota_filtro.venta_id == VentaDocumento.id,
                detalle_nota_filtro.articulo_id == articulo_id,
            )
            .exists()
        )
    ids_documentos = {documento["id"] for documento in documentos}
    for nota, venta, socio, punto, caja in (await sesion.execute(notas_periodo_consulta)).all():
        id_documento = f"NOTA_CREDITO:{nota.id}"
        if id_documento in ids_documentos:
            continue
        costo_nota = importe(
            await sesion.scalar(
                select(
                    func.coalesce(
                        func.sum(
                            NotaCreditoDetalle.cantidad_base
                            * VentaDocumentoDetalle.costo_unitario_bruto
                        ),
                        0,
                    )
                )
                .join(
                    VentaDocumentoDetalle,
                    VentaDocumentoDetalle.id == NotaCreditoDetalle.venta_detalle_id,
                )
                .where(NotaCreditoDetalle.nota_credito_id == nota.id)
            )
        )
        comprobante_origen = (
            f"{venta.letra} {punto.codigo}-{venta.numero or 0:08d}"
            if punto
            else f"{venta.letra} {venta.numero or 0:08d}"
        )
        importe_nota = -importe(nota.total_bruto)
        costo_nota_firmado = -costo_nota
        documentos.append(
            {
                "id": id_documento,
                "tipo": "NOTA_CREDITO",
                "fecha": nota.fecha_realizacion,
                "comprobante": f"NC {nota.numero:08d}",
                "documento_origen": comprobante_origen,
                "cliente": socio.razon_social,
                "punto_venta": (f"{punto.codigo} - {punto.descripcion}" if punto else "SIN PUNTO"),
                "caja": f"{caja.codigo} - {caja.descripcion}" if caja else "SIN CAJA",
                "modalidad": nota.modalidad,
                "motivo": nota.motivo,
                "importe": importe_nota,
                "costo": costo_nota_firmado,
                "margen": importe_nota - costo_nota_firmado,
                "margen_porcentual": importe(
                    ((importe_nota - costo_nota_firmado) / importe_nota * 100)
                    if importe_nota
                    else 0
                ),
            }
        )
    total_venta = importe(sum((x["venta_bruta"] for x in ventas), Decimal(0)))
    total_notas_credito = importe(sum((x["notas_credito"] for x in ventas), Decimal(0)))
    total_costo = importe(sum((x["costo_bruto"] for x in ventas), Decimal(0)))
    total_margen = total_venta - total_costo
    return {
        "desde": inicio.date(),
        "hasta": (fin - timedelta(days=1)).date(),
        "venta_bruta": total_venta,
        "notas_credito": total_notas_credito,
        "costo_bruto": total_costo,
        "margen_bruto": total_margen,
        "margen_porcentual": importe((total_margen / total_venta * 100) if total_venta else 0),
        "ventas": ventas,
        "documentos": sorted(documentos, key=lambda documento: documento["fecha"]),
    }
