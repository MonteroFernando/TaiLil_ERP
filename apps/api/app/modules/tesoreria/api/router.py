# ruff: noqa: E501
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Sequence, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.infrastructure.models import (
    AperturaCaja,
    CajaVenta,
    CobroDocumento,
    CobroMedioPago,
    CuentaCorrienteVenta,
    FacturaCompra,
    ImputacionCobroVenta,
    PuntoVenta,
    Socio,
    VentaDocumento,
)
from app.modules.tesoreria.api.schemas import (
    AnulacionConciliacion,
    ArqueoCrear,
    CierreCajaCrear,
    ConciliacionAgregar,
    CuentaCorrienteClienteResumen,
    CuentaCorrienteProveedorResumen,
    DocumentoTesoreriaCrear,
    DocumentoTesoreriaVista,
    MovimientoCajaCrear,
)
from app.modules.tesoreria.infrastructure.models import (
    ArqueoCaja,
    ArqueoCajaDetalle,
    CierreCaja,
    CierreCajaMedio,
    ImputacionPagoFactura,
    MovimientoCaja,
    PagoDocumento,
    PagoMedioPago,
)
from app.modules.usuarios.api.dependencias import (
    obtener_usuario_actual,
    requerir_alguno_de,
    requerir_permiso,
)
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/tesoreria", tags=["Tesoreria"])
CERO = Decimal("0.00")


def dinero(valor: Decimal | int | None) -> Decimal:
    return Decimal(valor or 0).quantize(Decimal("0.01"))


async def validar_apertura(apertura_id: UUID | None, sesion: AsyncSession) -> AperturaCaja | None:
    if apertura_id is None:
        return None
    apertura = await sesion.scalar(
        select(AperturaCaja).where(AperturaCaja.id == apertura_id).with_for_update()
    )
    if apertura is None or apertura.estado != "ABIERTA":
        raise HTTPException(409, "La apertura de caja no existe o ya fue cerrada")
    return apertura


async def cobro_vista(cobro: CobroDocumento, sesion: AsyncSession) -> DocumentoTesoreriaVista:
    socio = await sesion.get(Socio, cobro.cliente_id)
    medios = list(
        await sesion.scalars(select(CobroMedioPago).where(CobroMedioPago.cobro_id == cobro.id))
    )
    imputaciones = list(
        await sesion.scalars(
            select(ImputacionCobroVenta)
            .where(ImputacionCobroVenta.cobro_id == cobro.id)
            .order_by(ImputacionCobroVenta.fecha_imputacion)
        )
    )
    activo = sum((x.importe for x in imputaciones if x.estado == "ACTIVA"), CERO)
    return DocumentoTesoreriaVista(
        id=cobro.id,
        numero=cobro.numero,
        socio_id=cobro.cliente_id,
        socio_nombre=socio.razon_social if socio else "SOCIO INEXISTENTE",
        estado=cobro.estado,
        total=cobro.total,
        disponible=dinero(cobro.total - activo),
        fecha_realizacion=cobro.fecha_realizacion,
        medios=[
            {"medio": x.medio, "importe": x.importe, "referencia": x.referencia} for x in medios
        ],
        imputaciones=[
            {
                "id": str(x.id),
                "documento_id": str(x.venta_id),
                "importe": x.importe,
                "estado": x.estado,
                "fecha": x.fecha_imputacion,
                "motivo_anulacion": x.motivo_anulacion,
            }
            for x in imputaciones
        ],
    )


async def pago_vista(pago: PagoDocumento, sesion: AsyncSession) -> DocumentoTesoreriaVista:
    socio = await sesion.get(Socio, pago.proveedor_id)
    medios = list(
        await sesion.scalars(select(PagoMedioPago).where(PagoMedioPago.pago_id == pago.id))
    )
    imputaciones = list(
        await sesion.scalars(
            select(ImputacionPagoFactura)
            .where(ImputacionPagoFactura.pago_id == pago.id)
            .order_by(ImputacionPagoFactura.fecha_imputacion)
        )
    )
    activo = sum((x.importe for x in imputaciones if x.estado == "ACTIVA"), CERO)
    return DocumentoTesoreriaVista(
        id=pago.id,
        numero=pago.numero,
        socio_id=pago.proveedor_id,
        socio_nombre=socio.razon_social if socio else "SOCIO INEXISTENTE",
        estado=pago.estado,
        total=pago.total,
        disponible=dinero(pago.total - activo),
        fecha_realizacion=pago.fecha_realizacion,
        medios=[
            {"medio": x.medio, "importe": x.importe, "referencia": x.referencia} for x in medios
        ],
        imputaciones=[
            {
                "id": str(x.id),
                "documento_id": str(x.factura_id),
                "importe": x.importe,
                "estado": x.estado,
                "fecha": x.fecha_imputacion,
                "motivo_anulacion": x.motivo_anulacion,
            }
            for x in imputaciones
        ],
    )


async def imputar_cobro(
    cobro: CobroDocumento, items, usuario: Usuario, sesion: AsyncSession
) -> None:
    ya_imputado = dinero(
        await sesion.scalar(
            select(func.coalesce(func.sum(ImputacionCobroVenta.importe), 0)).where(
                ImputacionCobroVenta.cobro_id == cobro.id, ImputacionCobroVenta.estado == "ACTIVA"
            )
        )
    )
    if ya_imputado + sum((x.importe for x in items), CERO) > cobro.total:
        raise HTTPException(409, "Las imputaciones superan el saldo disponible del cobro")
    for item in items:
        venta = await sesion.scalar(
            select(VentaDocumento).where(VentaDocumento.id == item.documento_id).with_for_update()
        )
        if venta is None or venta.cliente_id != cobro.cliente_id or venta.estado != "CONFIRMADO":
            raise HTTPException(
                409, "La factura de venta no corresponde al cliente o no esta vigente"
            )
        if item.importe > venta.saldo_pendiente:
            raise HTTPException(409, f"La imputacion supera el saldo de la venta {venta.numero}")
        existente = await sesion.scalar(
            select(ImputacionCobroVenta).where(
                ImputacionCobroVenta.cobro_id == cobro.id,
                ImputacionCobroVenta.venta_id == venta.id,
                ImputacionCobroVenta.estado == "ACTIVA",
            )
        )
        if existente is not None:
            raise HTTPException(409, "Ese cobro ya posee una imputacion historica para la factura")
        sesion.add(
            ImputacionCobroVenta(
                cobro_id=cobro.id,
                venta_id=venta.id,
                importe=item.importe,
                estado="ACTIVA",
                usuario_id=usuario.id,
            )
        )
        venta.saldo_pendiente = dinero(venta.saldo_pendiente - item.importe)


async def imputar_pago(pago: PagoDocumento, items, usuario: Usuario, sesion: AsyncSession) -> None:
    ya_imputado = dinero(
        await sesion.scalar(
            select(func.coalesce(func.sum(ImputacionPagoFactura.importe), 0)).where(
                ImputacionPagoFactura.pago_id == pago.id, ImputacionPagoFactura.estado == "ACTIVA"
            )
        )
    )
    if ya_imputado + sum((x.importe for x in items), CERO) > pago.total:
        raise HTTPException(409, "Las imputaciones superan el saldo disponible del pago")
    for item in items:
        factura = await sesion.scalar(
            select(FacturaCompra).where(FacturaCompra.id == item.documento_id).with_for_update()
        )
        if (
            factura is None
            or factura.proveedor_id != pago.proveedor_id
            or factura.estado != "CONFIRMADO"
        ):
            raise HTTPException(
                409, "La factura de compra no corresponde al proveedor o no esta vigente"
            )
        if item.importe > factura.saldo_pendiente:
            raise HTTPException(
                409, f"La imputacion supera el saldo de la factura {factura.numero_proveedor}"
            )
        existente = await sesion.scalar(
            select(ImputacionPagoFactura).where(
                ImputacionPagoFactura.pago_id == pago.id,
                ImputacionPagoFactura.factura_id == factura.id,
                ImputacionPagoFactura.estado == "ACTIVA",
            )
        )
        if existente is not None:
            raise HTTPException(409, "Ese pago ya posee una imputacion historica para la factura")
        sesion.add(
            ImputacionPagoFactura(
                pago_id=pago.id,
                factura_id=factura.id,
                importe=item.importe,
                estado="ACTIVA",
                usuario_id=usuario.id,
            )
        )
        factura.saldo_pendiente = dinero(factura.saldo_pendiente - item.importe)


@router.get("/resumen", dependencies=[Depends(requerir_permiso("tesoreria.ver"))])
async def resumen(sesion: AsyncSession = Depends(obtener_sesion)) -> dict:
    ventas = dinero(
        await sesion.scalar(
            select(func.coalesce(func.sum(VentaDocumento.total_bruto), 0)).where(
                VentaDocumento.estado == "CONFIRMADO"
            )
        )
    )
    cobrar = dinero(
        await sesion.scalar(
            select(func.coalesce(func.sum(VentaDocumento.saldo_pendiente), 0)).where(
                VentaDocumento.estado == "CONFIRMADO"
            )
        )
    )
    pagar = dinero(
        await sesion.scalar(
            select(func.coalesce(func.sum(FacturaCompra.saldo_pendiente), 0)).where(
                FacturaCompra.estado == "CONFIRMADO"
            )
        )
    )
    cajas = int(
        await sesion.scalar(
            select(func.count()).select_from(AperturaCaja).where(AperturaCaja.estado == "ABIERTA")
        )
        or 0
    )
    return {
        "ventas_historicas": ventas,
        "cuentas_por_cobrar": cobrar,
        "cuentas_por_pagar": pagar,
        "cajas_abiertas": cajas,
    }


@router.get("/ventas", dependencies=[Depends(requerir_permiso("tesoreria.ver"))])
async def ventas(
    cliente_id: UUID | None = None,
    limite: int = Query(200, ge=1, le=500),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[dict]:
    consulta = (
        select(VentaDocumento, Socio)
        .join(Socio, Socio.id == VentaDocumento.cliente_id)
        .order_by(VentaDocumento.fecha_realizacion.desc())
        .limit(limite)
    )
    if cliente_id:
        consulta = consulta.where(VentaDocumento.cliente_id == cliente_id)
    filas = (await sesion.execute(consulta)).all()
    return [
        {
            "id": x.id,
            "numero": x.numero,
            "letra": x.letra,
            "tipo_documento": x.tipo_documento,
            "socio_id": s.id,
            "socio_nombre": s.razon_social,
            "total": x.total_bruto,
            "saldo_pendiente": x.saldo_pendiente,
            "estado": x.estado,
            "fecha": x.fecha_realizacion,
        }
        for x, s in filas
    ]


@router.get(
    "/cuentas-corrientes/clientes/resumen",
    response_model=list[CuentaCorrienteClienteResumen],
    dependencies=[Depends(requerir_permiso("tesoreria.ver"))],
)
async def resumen_cuentas_corrientes_clientes(
    buscar: str | None = None,
    solo_con_movimientos: bool = False,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[CuentaCorrienteClienteResumen]:
    deudas = (
        select(
            VentaDocumento.cliente_id.label("socio_id"),
            func.sum(VentaDocumento.saldo_pendiente).label("deuda_actual"),
            func.count(VentaDocumento.id).label("documentos_pendientes"),
            func.min(VentaDocumento.fecha_realizacion).label("deuda_mas_antigua"),
        )
        .where(
            VentaDocumento.estado == "CONFIRMADO",
            VentaDocumento.saldo_pendiente > 0,
        )
        .group_by(VentaDocumento.cliente_id)
        .subquery()
    )
    cobros = (
        select(
            CobroDocumento.cliente_id.label("socio_id"),
            func.sum(CobroDocumento.total).label("total_cobrado"),
        )
        .where(CobroDocumento.estado == "CONFIRMADO")
        .group_by(CobroDocumento.cliente_id)
        .subquery()
    )
    imputaciones = (
        select(
            CobroDocumento.cliente_id.label("socio_id"),
            func.sum(ImputacionCobroVenta.importe).label("total_imputado"),
        )
        .join(CobroDocumento, CobroDocumento.id == ImputacionCobroVenta.cobro_id)
        .where(
            CobroDocumento.estado == "CONFIRMADO",
            ImputacionCobroVenta.estado == "ACTIVA",
        )
        .group_by(CobroDocumento.cliente_id)
        .subquery()
    )
    deuda_actual = func.coalesce(deudas.c.deuda_actual, 0)
    saldo_favor = func.coalesce(cobros.c.total_cobrado, 0) - func.coalesce(
        imputaciones.c.total_imputado, 0
    )
    consulta = (
        select(
            Socio,
            CuentaCorrienteVenta,
            deuda_actual.label("deuda_actual"),
            saldo_favor.label("saldo_favor"),
            func.coalesce(deudas.c.documentos_pendientes, 0).label(
                "documentos_pendientes"
            ),
            deudas.c.deuda_mas_antigua,
        )
        .outerjoin(CuentaCorrienteVenta, CuentaCorrienteVenta.socio_id == Socio.id)
        .outerjoin(deudas, deudas.c.socio_id == Socio.id)
        .outerjoin(cobros, cobros.c.socio_id == Socio.id)
        .outerjoin(imputaciones, imputaciones.c.socio_id == Socio.id)
        .where(Socio.es_cliente.is_(True), Socio.activo.is_(True))
        .order_by(Socio.razon_social, Socio.codigo)
    )
    if solo_con_movimientos:
        consulta = consulta.where(or_(deuda_actual > 0, saldo_favor > 0))
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Socio.codigo.ilike(patron),
                    Socio.razon_social.ilike(patron),
                    Socio.numero_documento.ilike(patron),
                )
            )
    filas = (await sesion.execute(consulta)).all()
    return [
        CuentaCorrienteClienteResumen(
            socio_id=socio.id,
            codigo=socio.codigo,
            razon_social=socio.razon_social,
            numero_documento=socio.numero_documento,
            cuenta_configurada=cuenta is not None,
            cuenta_activa=bool(cuenta and cuenta.activa),
            deuda_actual=dinero(deuda),
            saldo_favor=max(CERO, dinero(favor)),
            documentos_pendientes=int(cantidad or 0),
            deuda_mas_antigua=antigua,
        )
        for socio, cuenta, deuda, favor, cantidad, antigua in filas
    ]


@router.get(
    "/cuentas-corrientes/proveedores/resumen",
    response_model=list[CuentaCorrienteProveedorResumen],
    dependencies=[Depends(requerir_permiso("tesoreria.ver"))],
)
async def resumen_cuentas_corrientes_proveedores(
    buscar: str | None = None,
    solo_con_movimientos: bool = False,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[CuentaCorrienteProveedorResumen]:
    deudas = (
        select(
            FacturaCompra.proveedor_id.label("socio_id"),
            func.sum(FacturaCompra.saldo_pendiente).label("deuda_actual"),
            func.count(FacturaCompra.id).label("documentos_pendientes"),
            func.min(FacturaCompra.fecha_realizacion).label("deuda_mas_antigua"),
        )
        .where(FacturaCompra.estado == "CONFIRMADO", FacturaCompra.saldo_pendiente > 0)
        .group_by(FacturaCompra.proveedor_id)
        .subquery()
    )
    pagos = (
        select(
            PagoDocumento.proveedor_id.label("socio_id"),
            func.sum(PagoDocumento.total).label("total_pagado"),
        )
        .where(PagoDocumento.estado == "CONFIRMADO")
        .group_by(PagoDocumento.proveedor_id)
        .subquery()
    )
    imputaciones = (
        select(
            PagoDocumento.proveedor_id.label("socio_id"),
            func.sum(ImputacionPagoFactura.importe).label("total_imputado"),
        )
        .join(PagoDocumento, PagoDocumento.id == ImputacionPagoFactura.pago_id)
        .where(
            PagoDocumento.estado == "CONFIRMADO",
            ImputacionPagoFactura.estado == "ACTIVA",
        )
        .group_by(PagoDocumento.proveedor_id)
        .subquery()
    )
    deuda_actual = func.coalesce(deudas.c.deuda_actual, 0)
    saldo_favor = func.coalesce(pagos.c.total_pagado, 0) - func.coalesce(
        imputaciones.c.total_imputado, 0
    )
    consulta = (
        select(
            Socio,
            deuda_actual.label("deuda_actual"),
            saldo_favor.label("saldo_favor"),
            func.coalesce(deudas.c.documentos_pendientes, 0).label(
                "documentos_pendientes"
            ),
            deudas.c.deuda_mas_antigua,
        )
        .outerjoin(deudas, deudas.c.socio_id == Socio.id)
        .outerjoin(pagos, pagos.c.socio_id == Socio.id)
        .outerjoin(imputaciones, imputaciones.c.socio_id == Socio.id)
        .where(Socio.es_proveedor.is_(True), Socio.activo.is_(True))
        .order_by(Socio.razon_social, Socio.codigo)
    )
    if solo_con_movimientos:
        consulta = consulta.where(or_(deuda_actual > 0, saldo_favor > 0))
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Socio.codigo.ilike(patron),
                    Socio.razon_social.ilike(patron),
                    Socio.numero_documento.ilike(patron),
                )
            )
    filas = (await sesion.execute(consulta)).all()
    return [
        CuentaCorrienteProveedorResumen(
            socio_id=socio.id,
            codigo=socio.codigo,
            razon_social=socio.razon_social,
            numero_documento=socio.numero_documento,
            deuda_actual=dinero(deuda),
            saldo_favor=max(CERO, dinero(favor)),
            documentos_pendientes=int(cantidad or 0),
            deuda_mas_antigua=antigua,
        )
        for socio, deuda, favor, cantidad, antigua in filas
    ]


@router.get("/cuentas-corrientes/{tipo}", dependencies=[Depends(requerir_permiso("tesoreria.ver"))])
async def cuentas_corrientes(
    tipo: str,
    socio_id: UUID | None = None,
    solo_pendientes: bool = True,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[dict]:
    if tipo == "clientes":
        consulta = (
            select(VentaDocumento, Socio)
            .join(Socio, Socio.id == VentaDocumento.cliente_id)
            .where(VentaDocumento.estado == "CONFIRMADO")
        )
        if socio_id:
            consulta = consulta.where(VentaDocumento.cliente_id == socio_id)
        if solo_pendientes:
            consulta = consulta.where(VentaDocumento.saldo_pendiente > 0)
        filas = (await sesion.execute(consulta.order_by(VentaDocumento.fecha_realizacion))).all()
        return [
            {
                "id": d.id,
                "numero": d.numero,
                "numero_externo": None,
                "socio_id": s.id,
                "socio_nombre": s.razon_social,
                "total": d.total_bruto,
                "saldo_pendiente": d.saldo_pendiente,
                "fecha": d.fecha_realizacion,
            }
            for d, s in filas
        ]
    if tipo == "proveedores":
        consulta = (
            select(FacturaCompra, Socio)
            .join(Socio, Socio.id == FacturaCompra.proveedor_id)
            .where(FacturaCompra.estado == "CONFIRMADO")
        )
        if socio_id:
            consulta = consulta.where(FacturaCompra.proveedor_id == socio_id)
        if solo_pendientes:
            consulta = consulta.where(FacturaCompra.saldo_pendiente > 0)
        filas = (await sesion.execute(consulta.order_by(FacturaCompra.fecha_realizacion))).all()
        return [
            {
                "id": d.id,
                "numero": d.numero,
                "numero_externo": d.numero_proveedor,
                "socio_id": s.id,
                "socio_nombre": s.razon_social,
                "total": d.total_bruto,
                "saldo_pendiente": d.saldo_pendiente,
                "fecha": d.fecha_realizacion,
            }
            for d, s in filas
        ]
    raise HTTPException(400, "El tipo debe ser clientes o proveedores")


@router.post(
    "/cobros",
    response_model=DocumentoTesoreriaVista,
    status_code=201,
    dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))],
)
async def crear_cobro(
    datos: DocumentoTesoreriaCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> DocumentoTesoreriaVista:
    socio = await sesion.get(Socio, datos.socio_id)
    if socio is None or not socio.activo or not socio.es_cliente:
        raise HTTPException(400, "Cliente inexistente o inactivo")
    await validar_apertura(datos.apertura_caja_id, sesion)
    total = dinero(sum((x.importe for x in datos.medios), CERO))
    numero = await sesion.scalar(select(Sequence("secuencia_cobros").next_value()))
    cobro = CobroDocumento(
        numero=numero,
        cliente_id=socio.id,
        apertura_caja_id=datos.apertura_caja_id,
        estado="CONFIRMADO",
        total=total,
        usuario_id=usuario.id,
    )
    sesion.add(cobro)
    await sesion.flush()
    sesion.add_all(
        [
            CobroMedioPago(
                cobro_id=cobro.id, medio=x.medio, importe=x.importe, referencia=x.referencia
            )
            for x in datos.medios
        ]
    )
    await imputar_cobro(cobro, datos.imputaciones, usuario, sesion)
    await sesion.commit()
    await sesion.refresh(cobro)
    return await cobro_vista(cobro, sesion)


@router.post(
    "/pagos",
    response_model=DocumentoTesoreriaVista,
    status_code=201,
    dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))],
)
async def crear_pago(
    datos: DocumentoTesoreriaCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> DocumentoTesoreriaVista:
    socio = await sesion.get(Socio, datos.socio_id)
    if socio is None or not socio.activo or not socio.es_proveedor:
        raise HTTPException(400, "Proveedor inexistente o inactivo")
    await validar_apertura(datos.apertura_caja_id, sesion)
    total = dinero(sum((x.importe for x in datos.medios), CERO))
    numero = await sesion.scalar(select(Sequence("secuencia_pagos").next_value()))
    pago = PagoDocumento(
        numero=numero,
        proveedor_id=socio.id,
        apertura_caja_id=datos.apertura_caja_id,
        estado="CONFIRMADO",
        total=total,
        observacion=datos.observacion,
        usuario_id=usuario.id,
    )
    sesion.add(pago)
    await sesion.flush()
    sesion.add_all(
        [
            PagoMedioPago(
                pago_id=pago.id, medio=x.medio, importe=x.importe, referencia=x.referencia
            )
            for x in datos.medios
        ]
    )
    await imputar_pago(pago, datos.imputaciones, usuario, sesion)
    await sesion.commit()
    await sesion.refresh(pago)
    return await pago_vista(pago, sesion)


@router.get(
    "/cobros",
    response_model=list[DocumentoTesoreriaVista],
    dependencies=[Depends(requerir_permiso("tesoreria.ver"))],
)
async def listar_cobros(
    socio_id: UUID | None = None, sesion: AsyncSession = Depends(obtener_sesion)
):
    consulta = select(CobroDocumento).order_by(CobroDocumento.fecha_realizacion.desc()).limit(300)
    if socio_id:
        consulta = consulta.where(CobroDocumento.cliente_id == socio_id)
    return [await cobro_vista(x, sesion) for x in await sesion.scalars(consulta)]


@router.get(
    "/pagos",
    response_model=list[DocumentoTesoreriaVista],
    dependencies=[Depends(requerir_permiso("tesoreria.ver"))],
)
async def listar_pagos(
    socio_id: UUID | None = None, sesion: AsyncSession = Depends(obtener_sesion)
):
    consulta = select(PagoDocumento).order_by(PagoDocumento.fecha_realizacion.desc()).limit(300)
    if socio_id:
        consulta = consulta.where(PagoDocumento.proveedor_id == socio_id)
    return [await pago_vista(x, sesion) for x in await sesion.scalars(consulta)]


@router.post(
    "/conciliaciones/{tipo}", dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))]
)
async def agregar_conciliaciones(
    tipo: str,
    datos: ConciliacionAgregar,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    if tipo == "clientes":
        documento = await sesion.scalar(
            select(CobroDocumento)
            .where(CobroDocumento.id == datos.documento_pago_id)
            .with_for_update()
        )
        if documento is None:
            raise HTTPException(404, "Cobro no encontrado")
        await imputar_cobro(documento, datos.imputaciones, usuario, sesion)
    elif tipo == "proveedores":
        documento = await sesion.scalar(
            select(PagoDocumento)
            .where(PagoDocumento.id == datos.documento_pago_id)
            .with_for_update()
        )
        if documento is None:
            raise HTTPException(404, "Pago no encontrado")
        await imputar_pago(documento, datos.imputaciones, usuario, sesion)
    else:
        raise HTTPException(400, "El tipo debe ser clientes o proveedores")
    await sesion.commit()
    return {"ok": True}


@router.post(
    "/conciliaciones/{tipo}/{imputacion_id}/anular",
    dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))],
)
async def anular_conciliacion(
    tipo: str,
    imputacion_id: UUID,
    datos: AnulacionConciliacion,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    if tipo == "clientes":
        item = await sesion.scalar(
            select(ImputacionCobroVenta)
            .where(ImputacionCobroVenta.id == imputacion_id)
            .with_for_update()
        )
        if item is None:
            raise HTTPException(404, "Conciliacion no encontrada")
        documento = await sesion.scalar(
            select(VentaDocumento).where(VentaDocumento.id == item.venta_id).with_for_update()
        )
    elif tipo == "proveedores":
        item = await sesion.scalar(
            select(ImputacionPagoFactura)
            .where(ImputacionPagoFactura.id == imputacion_id)
            .with_for_update()
        )
        if item is None:
            raise HTTPException(404, "Conciliacion no encontrada")
        documento = await sesion.scalar(
            select(FacturaCompra).where(FacturaCompra.id == item.factura_id).with_for_update()
        )
    else:
        raise HTTPException(400, "El tipo debe ser clientes o proveedores")
    if item.estado != "ACTIVA":
        raise HTTPException(409, "La conciliacion ya fue anulada")
    item.estado = "ANULADA"
    item.anulada_por_id = usuario.id
    item.fecha_anulacion = datetime.now(UTC)
    item.motivo_anulacion = datos.motivo
    documento.saldo_pendiente = dinero(documento.saldo_pendiente + item.importe)
    await sesion.commit()
    return {"ok": True}


async def totales_apertura(apertura_id: UUID, sesion: AsyncSession) -> dict:
    apertura = await sesion.get(AperturaCaja, apertura_id)
    if apertura is None:
        raise HTTPException(404, "Apertura no encontrada")
    ventas_total, ventas_cantidad = (
        await sesion.execute(
            select(func.coalesce(func.sum(VentaDocumento.total_bruto), 0), func.count()).where(
                VentaDocumento.apertura_caja_id == apertura_id,
                VentaDocumento.estado == "CONFIRMADO",
            )
        )
    ).one()
    cobros = (
        await sesion.execute(
            select(CobroMedioPago.medio, func.sum(CobroMedioPago.importe))
            .join(CobroDocumento, CobroDocumento.id == CobroMedioPago.cobro_id)
            .where(
                CobroDocumento.apertura_caja_id == apertura_id,
                CobroDocumento.estado == "CONFIRMADO",
            )
            .group_by(CobroMedioPago.medio)
        )
    ).all()
    pagos = (
        await sesion.execute(
            select(PagoMedioPago.medio, func.sum(PagoMedioPago.importe))
            .join(PagoDocumento, PagoDocumento.id == PagoMedioPago.pago_id)
            .where(
                PagoDocumento.apertura_caja_id == apertura_id, PagoDocumento.estado == "CONFIRMADO"
            )
            .group_by(PagoMedioPago.medio)
        )
    ).all()
    movimientos = (
        await sesion.execute(
            select(MovimientoCaja.medio, MovimientoCaja.tipo, func.sum(MovimientoCaja.importe))
            .where(
                MovimientoCaja.apertura_caja_id == apertura_id,
                MovimientoCaja.estado == "CONFIRMADO",
            )
            .group_by(MovimientoCaja.medio, MovimientoCaja.tipo)
        )
    ).all()
    medios: dict[str, Decimal] = {"EFECTIVO": dinero(apertura.efectivo_inicial)}
    for medio, importe in cobros:
        medios[medio] = dinero(medios.get(medio, CERO) + importe)
    for medio, importe in pagos:
        medios[medio] = dinero(medios.get(medio, CERO) - importe)
    ingresos = egresos = CERO
    for medio, tipo, importe in movimientos:
        signo = 1 if tipo == "INGRESO" else -1
        medios[medio] = dinero(medios.get(medio, CERO) + signo * importe)
        if tipo == "INGRESO":
            ingresos += importe
        else:
            egresos += importe
    return {
        "apertura_id": apertura.id,
        "estado": apertura.estado,
        "efectivo_inicial": apertura.efectivo_inicial,
        "total_ventas": dinero(ventas_total),
        "cantidad_ventas": ventas_cantidad,
        "total_cobros": dinero(sum((x[1] for x in cobros), CERO)),
        "total_pagos": dinero(sum((x[1] for x in pagos), CERO)),
        "total_ingresos": dinero(ingresos),
        "total_egresos": dinero(egresos),
        "medios": [{"medio": k, "esperado": v} for k, v in sorted(medios.items())],
    }


@router.get(
    "/cajas/{apertura_id}/control",
    dependencies=[Depends(requerir_alguno_de("tesoreria.ver", "ventas.caja.cerrar"))],
)
async def control_caja(
    apertura_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    apertura = await sesion.get(AperturaCaja, apertura_id)
    if apertura is None:
        raise HTTPException(404, "La apertura de caja no existe")
    if not usuario.es_administrador and apertura.usuario_id != usuario.id:
        raise HTTPException(403, "Solo puede controlar su propia caja")
    return await totales_apertura(apertura_id, sesion)


@router.post(
    "/cajas/movimientos",
    status_code=201,
    dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))],
)
async def crear_movimiento(
    datos: MovimientoCajaCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    await validar_apertura(datos.apertura_caja_id, sesion)
    item = MovimientoCaja(**datos.model_dump(), estado="CONFIRMADO", usuario_id=usuario.id)
    sesion.add(item)
    await sesion.commit()
    await sesion.refresh(item)
    return {"id": item.id, "fecha": item.fecha_realizacion}


@router.post(
    "/cajas/arqueos",
    status_code=201,
    dependencies=[Depends(requerir_permiso("tesoreria.gestionar"))],
)
async def crear_arqueo(
    datos: ArqueoCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    await validar_apertura(datos.apertura_caja_id, sesion)
    total = dinero(sum((x.denominacion * x.cantidad for x in datos.denominaciones), CERO))
    arqueo = ArqueoCaja(
        apertura_caja_id=datos.apertura_caja_id,
        total_declarado=total,
        observacion=datos.observacion,
        usuario_id=usuario.id,
    )
    sesion.add(arqueo)
    await sesion.flush()
    sesion.add_all(
        [
            ArqueoCajaDetalle(
                arqueo_id=arqueo.id,
                denominacion=x.denominacion,
                cantidad=x.cantidad,
                subtotal=dinero(x.denominacion * x.cantidad),
            )
            for x in datos.denominaciones
        ]
    )
    control = await totales_apertura(datos.apertura_caja_id, sesion)
    esperado = next((x["esperado"] for x in control["medios"] if x["medio"] == "EFECTIVO"), CERO)
    await sesion.commit()
    await sesion.refresh(arqueo)
    return {
        "id": arqueo.id,
        "total_declarado": total,
        "efectivo_esperado": esperado,
        "diferencia": dinero(total - esperado),
        "fecha": arqueo.fecha,
    }


@router.get(
    "/cajas/{apertura_id}/arqueos", dependencies=[Depends(requerir_permiso("tesoreria.ver"))]
)
async def listar_arqueos(
    apertura_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> list[dict]:
    items = await sesion.scalars(
        select(ArqueoCaja)
        .where(ArqueoCaja.apertura_caja_id == apertura_id)
        .order_by(ArqueoCaja.fecha.desc())
    )
    return [
        {
            "id": x.id,
            "total_declarado": x.total_declarado,
            "observacion": x.observacion,
            "fecha": x.fecha,
            "usuario_id": x.usuario_id,
        }
        for x in items
    ]


@router.post(
    "/cajas/{apertura_id}/cerrar",
    status_code=201,
    dependencies=[Depends(requerir_alguno_de("tesoreria.gestionar", "ventas.caja.cerrar"))],
)
async def cerrar_caja(
    apertura_id: UUID,
    datos: CierreCajaCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    apertura = await sesion.scalar(
        select(AperturaCaja).where(AperturaCaja.id == apertura_id).with_for_update()
    )
    if apertura is None or apertura.estado != "ABIERTA":
        raise HTTPException(409, "La caja no esta abierta")
    if not usuario.es_administrador and apertura.usuario_id != usuario.id:
        raise HTTPException(403, "Solo puede cerrar su propia caja")
    if await sesion.scalar(
        select(VentaDocumento.id).where(
            VentaDocumento.apertura_caja_id == apertura_id,
            VentaDocumento.estado == "BORRADOR",
        ).limit(1)
    ):
        raise HTTPException(409, "Debe confirmar o eliminar los borradores antes de cerrar la caja")
    if await sesion.scalar(select(CierreCaja.id).where(CierreCaja.apertura_caja_id == apertura_id)):
        raise HTTPException(409, "La apertura ya posee un cierre")
    control = await totales_apertura(apertura_id, sesion)
    esperados = {x["medio"]: dinero(x["esperado"]) for x in control["medios"]}
    declarados = {x.medio.upper(): dinero(x.declarado) for x in datos.medios}
    todos = sorted(set(esperados) | set(declarados))
    efectivo_esperado = esperados.get("EFECTIVO", CERO)
    efectivo_declarado = declarados.get("EFECTIVO", CERO)
    cierre = CierreCaja(
        apertura_caja_id=apertura_id,
        total_ventas=control["total_ventas"],
        total_cobros=control["total_cobros"],
        total_pagos=control["total_pagos"],
        total_ingresos=control["total_ingresos"],
        total_egresos=control["total_egresos"],
        efectivo_esperado=efectivo_esperado,
        efectivo_declarado=efectivo_declarado,
        diferencia=dinero(efectivo_declarado - efectivo_esperado),
        cantidad_ventas=control["cantidad_ventas"],
        observacion=datos.observacion,
        usuario_id=usuario.id,
    )
    sesion.add(cierre)
    await sesion.flush()
    sesion.add_all(
        [
            CierreCajaMedio(
                cierre_id=cierre.id,
                medio=medio,
                esperado=esperados.get(medio, CERO),
                declarado=declarados.get(medio, CERO),
                diferencia=dinero(declarados.get(medio, CERO) - esperados.get(medio, CERO)),
            )
            for medio in todos
        ]
    )
    apertura.estado = "CERRADA"
    apertura.fecha_cierre = datetime.now(UTC)
    await sesion.commit()
    await sesion.refresh(cierre)
    return {
        "id": cierre.id,
        "apertura_id": apertura_id,
        "efectivo_esperado": cierre.efectivo_esperado,
        "efectivo_declarado": cierre.efectivo_declarado,
        "diferencia": cierre.diferencia,
        "fecha": cierre.fecha,
    }


@router.get("/cajas/cierres/historial", dependencies=[Depends(requerir_permiso("tesoreria.ver"))])
async def historial_cierres(
    periodo: date | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    limite: int = Query(500, ge=1, le=1000),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[dict]:
    if desde and hasta and desde > hasta:
        raise HTTPException(400, "La fecha desde no puede ser posterior a la fecha hasta")
    consulta = (
        select(CierreCaja, AperturaCaja, CajaVenta, PuntoVenta, Usuario)
        .join(AperturaCaja, AperturaCaja.id == CierreCaja.apertura_caja_id)
        .join(CajaVenta, CajaVenta.id == AperturaCaja.caja_id)
        .join(PuntoVenta, PuntoVenta.id == CajaVenta.punto_venta_id)
        .join(Usuario, Usuario.id == CierreCaja.usuario_id)
    )
    if periodo:
        consulta = consulta.where(AperturaCaja.periodo_operativo == periodo)
    if desde:
        consulta = consulta.where(AperturaCaja.periodo_operativo >= desde)
    if hasta:
        consulta = consulta.where(AperturaCaja.periodo_operativo <= hasta)
    filas = (
        await sesion.execute(
            consulta.order_by(AperturaCaja.periodo_operativo.desc(), CierreCaja.fecha.desc()).limit(
                limite
            )
        )
    ).all()
    resultado = []
    for c, a, caja, punto, u in filas:
        medios = list(
            await sesion.scalars(
                select(CierreCajaMedio)
                .where(CierreCajaMedio.cierre_id == c.id)
                .order_by(CierreCajaMedio.medio)
            )
        )
        resultado.append(
            {
                "id": c.id,
                "apertura_id": a.id,
                "caja": caja.codigo,
                "punto_venta": punto.codigo,
                "usuario": u.nombre_usuario,
                "periodo_operativo": a.periodo_operativo,
                "fecha_apertura": a.fecha_apertura,
                "fecha_cierre": c.fecha,
                "cantidad_ventas": c.cantidad_ventas,
                "total_ventas": c.total_ventas,
                "total_cobros": c.total_cobros,
                "total_pagos": c.total_pagos,
                "efectivo_esperado": c.efectivo_esperado,
                "efectivo_declarado": c.efectivo_declarado,
                "diferencia": c.diferencia,
                "observacion": c.observacion,
                "medios": [
                    {
                        "medio": x.medio,
                        "esperado": x.esperado,
                        "declarado": x.declarado,
                        "diferencia": x.diferencia,
                    }
                    for x in medios
                ],
            }
        )
    return resultado
