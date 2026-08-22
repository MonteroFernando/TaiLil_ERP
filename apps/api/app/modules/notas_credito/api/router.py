from decimal import ROUND_HALF_UP, Decimal
from html import escape
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import Sequence, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.infrastructure.models import (
    Almacen,
    AperturaCaja,
    Articulo,
    CobroDocumento,
    CobroMedioPago,
    FacturaCompra,
    FacturaCompraDetalle,
    ImputacionCobroVenta,
    MovimientoStock,
    MovimientoStockDetalle,
    NotaCredito,
    NotaCreditoDetalle,
    Socio,
    StockArticuloAlmacen,
    VentaDocumento,
    VentaDocumentoDetalle,
)
from app.modules.notas_credito.api.schemas import NotaCreditoCrear, NotaCreditoVista
from app.modules.tesoreria.infrastructure.models import (
    ImputacionPagoFactura,
    MovimientoCaja,
    PagoDocumento,
    PagoMedioPago,
)
from app.modules.usuarios.api.dependencias import obtener_usuario_actual
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/notas-credito", tags=["Notas de credito"])
CERO = Decimal("0")


def dinero(valor: Decimal | int) -> Decimal:
    return Decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def asegurar_permiso(usuario: Usuario, codigo: str, sesion: AsyncSession) -> None:
    if usuario.es_administrador:
        return
    if codigo not in await obtener_codigos_permisos(usuario, sesion):
        raise HTTPException(403, f"Falta el permiso requerido: {codigo}")


async def nuevo_movimiento(
    sesion: AsyncSession, usuario: Usuario, tipo: str, numero: int, almacen_id: UUID
) -> MovimientoStock:
    correlativo = await sesion.scalar(select(Sequence("secuencia_movimientos_stock").next_value()))
    movimiento = MovimientoStock(
        numero=correlativo,
        tipo=tipo,
        estado="CONFIRMADO",
        almacen_origen_id=almacen_id if tipo == "NOTA_CREDITO_PROVEEDOR" else None,
        almacen_destino_id=almacen_id if tipo == "NOTA_CREDITO_CLIENTE" else None,
        documento_tipo="NOTA_CREDITO",
        documento_numero=f"NC {numero:08d}",
        observacion=f"NOTA DE CREDITO {numero:08d}",
        usuario_id=usuario.id,
    )
    sesion.add(movimiento)
    await sesion.flush()
    return movimiento


async def impactar_stock(
    sesion: AsyncSession,
    movimiento: MovimientoStock,
    articulo: Articulo,
    almacen_id: UUID,
    cantidad: Decimal,
) -> None:
    stock = await sesion.scalar(
        select(StockArticuloAlmacen)
        .where(
            StockArticuloAlmacen.articulo_id == articulo.id,
            StockArticuloAlmacen.almacen_id == almacen_id,
        )
        .with_for_update()
    )
    if stock is None:
        stock = StockArticuloAlmacen(articulo_id=articulo.id, almacen_id=almacen_id)
        sesion.add(stock)
        await sesion.flush()
    anterior = stock.cantidad_fisica
    stock.cantidad_fisica = anterior + cantidad
    sesion.add(
        MovimientoStockDetalle(
            movimiento_id=movimiento.id,
            articulo_id=articulo.id,
            almacen_id=almacen_id,
            cantidad_base=cantidad,
            unidad_medida_id=articulo.unidad_base_id,
            factor_conversion=Decimal("1"),
            saldo_anterior=anterior,
            saldo_posterior=stock.cantidad_fisica,
        )
    )


async def nota_vista(nota: NotaCredito, sesion: AsyncSession) -> NotaCreditoVista:
    socio = await sesion.get(Socio, nota.socio_id)
    almacen = await sesion.get(Almacen, nota.almacen_id)
    filas = (
        await sesion.execute(
            select(NotaCreditoDetalle, Articulo)
            .join(Articulo, Articulo.id == NotaCreditoDetalle.articulo_id)
            .where(NotaCreditoDetalle.nota_credito_id == nota.id)
            .order_by(NotaCreditoDetalle.id)
        )
    ).all()
    if nota.tipo == "CLIENTE":
        origen = await sesion.get(VentaDocumento, nota.venta_id)
        origen_texto = f"{origen.letra} {origen.numero or 0:08d}" if origen else "VENTA INEXISTENTE"
        origen_id = nota.venta_id
    else:
        origen = await sesion.get(FacturaCompra, nota.factura_compra_id)
        origen_texto = origen.comprobante_proveedor if origen else "FACTURA INEXISTENTE"
        origen_id = nota.factura_compra_id
    devolucion = await sesion.get(CobroDocumento, nota.devolucion_cobro_id)
    movimiento_caja = await sesion.get(MovimientoCaja, nota.movimiento_caja_id)
    return NotaCreditoVista(
        id=nota.id,
        numero=nota.numero,
        tipo=nota.tipo,
        socio_id=nota.socio_id,
        socio_nombre=socio.razon_social if socio else "SOCIO INEXISTENTE",
        documento_origen_id=origen_id,
        documento_origen=origen_texto,
        almacen_id=nota.almacen_id,
        almacen_codigo=almacen.codigo if almacen else "",
        numero_externo=nota.numero_externo,
        modalidad=nota.modalidad,
        motivo=nota.motivo,
        afecta_stock=nota.afecta_stock,
        total_bruto=nota.total_bruto,
        estado=nota.estado,
        fecha_realizacion=nota.fecha_realizacion,
        medio_devolucion=movimiento_caja.medio if movimiento_caja else None,
        importe_devolucion=dinero(abs(devolucion.total)) if devolucion else CERO,
        lineas=[
            {
                "articulo_id": str(detalle.articulo_id),
                "articulo_codigo": articulo.codigo,
                "articulo_descripcion": articulo.descripcion,
                "cantidad_base": detalle.cantidad_base,
                "importe_unitario_bruto": detalle.importe_unitario_bruto,
                "porcentaje_iva": detalle.porcentaje_iva,
                "total_bruto": detalle.total_bruto,
            }
            for detalle, articulo in filas
        ],
    )


async def cantidad_acreditada(tipo: str, detalle_id: UUID, sesion: AsyncSession) -> Decimal:
    campo = (
        NotaCreditoDetalle.venta_detalle_id
        if tipo == "CLIENTE"
        else NotaCreditoDetalle.factura_detalle_id
    )
    return Decimal(
        await sesion.scalar(
            select(func.coalesce(func.sum(NotaCreditoDetalle.cantidad_base), 0))
            .join(NotaCredito, NotaCredito.id == NotaCreditoDetalle.nota_credito_id)
            .where(campo == detalle_id, NotaCredito.estado == "CONFIRMADO")
        )
        or 0
    )


async def total_acreditado(tipo: str, documento_id: UUID, sesion: AsyncSession) -> Decimal:
    campo = NotaCredito.venta_id if tipo == "CLIENTE" else NotaCredito.factura_compra_id
    return Decimal(
        await sesion.scalar(
            select(func.coalesce(func.sum(NotaCredito.total_bruto), 0)).where(
                campo == documento_id, NotaCredito.estado == "CONFIRMADO"
            )
        )
        or 0
    )


@router.get("/origenes")
async def listar_origenes(
    tipo: Literal["CLIENTE", "PROVEEDOR"],
    socio_id: UUID | None = None,
    sesion: AsyncSession = Depends(obtener_sesion),
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> list[dict]:
    await asegurar_permiso(usuario, "ventas.ver" if tipo == "CLIENTE" else "compras.ver", sesion)
    if tipo == "CLIENTE":
        consulta = select(VentaDocumento).where(VentaDocumento.estado == "CONFIRMADO")
        if socio_id:
            consulta = consulta.where(VentaDocumento.cliente_id == socio_id)
        documentos = list(
            await sesion.scalars(
                consulta.order_by(VentaDocumento.fecha_realizacion.desc()).limit(100)
            )
        )
        salida = []
        for documento in documentos:
            socio = await sesion.get(Socio, documento.cliente_id)
            detalles = list(
                await sesion.scalars(
                    select(VentaDocumentoDetalle).where(
                        VentaDocumentoDetalle.venta_id == documento.id
                    )
                )
            )
            lineas = []
            credito_disponible = dinero(
                documento.total_bruto - await total_acreditado(tipo, documento.id, sesion)
            )
            for d in detalles:
                articulo = await sesion.get(Articulo, d.articulo_id)
                disponible = d.cantidad_base - await cantidad_acreditada(tipo, d.id, sesion)
                if disponible > 0:
                    lineas.append(
                        {
                            "detalle_id": str(d.id),
                            "articulo_id": str(d.articulo_id),
                            "codigo": articulo.codigo,
                            "descripcion": articulo.descripcion,
                            "cantidad_original": d.cantidad_base,
                            "cantidad_disponible": disponible,
                            "importe_unitario_bruto": d.precio_unitario_bruto,
                            "total_disponible": dinero(disponible * d.precio_unitario_bruto),
                        }
                    )
            if credito_disponible > 0:
                salida.append(
                    {
                        "id": str(documento.id),
                        "socio_id": str(documento.cliente_id),
                        "socio_nombre": socio.razon_social,
                        "numero": f"{documento.letra} {documento.numero or 0:08d}",
                        "fecha": documento.fecha_realizacion,
                        "total": documento.total_bruto,
                        "saldo_pendiente": documento.saldo_pendiente,
                        "credito_disponible": max(CERO, credito_disponible),
                        "lineas": lineas,
                    }
                )
        return salida
    consulta = select(FacturaCompra).where(FacturaCompra.estado == "CONFIRMADO")
    if socio_id:
        consulta = consulta.where(FacturaCompra.proveedor_id == socio_id)
    documentos = list(
        await sesion.scalars(consulta.order_by(FacturaCompra.fecha_realizacion.desc()).limit(100))
    )
    salida = []
    for documento in documentos:
        socio = await sesion.get(Socio, documento.proveedor_id)
        detalles = list(
            await sesion.scalars(
                select(FacturaCompraDetalle).where(FacturaCompraDetalle.factura_id == documento.id)
            )
        )
        lineas = []
        credito_disponible = dinero(
            documento.total_bruto - await total_acreditado(tipo, documento.id, sesion)
        )
        for d in detalles:
            articulo = await sesion.get(Articulo, d.articulo_id)
            disponible = d.cantidad_base - await cantidad_acreditada(tipo, d.id, sesion)
            if disponible > 0:
                lineas.append(
                    {
                        "detalle_id": str(d.id),
                        "articulo_id": str(d.articulo_id),
                        "codigo": articulo.codigo,
                        "descripcion": articulo.descripcion,
                        "cantidad_original": d.cantidad_base,
                        "cantidad_disponible": disponible,
                        "importe_unitario_bruto": d.costo_bruto_unitario,
                        "total_disponible": dinero(disponible * d.costo_bruto_unitario),
                    }
                )
        if lineas:
            salida.append(
                {
                    "id": str(documento.id),
                    "socio_id": str(documento.proveedor_id),
                    "socio_nombre": socio.razon_social,
                    "numero": documento.comprobante_proveedor,
                    "fecha": documento.fecha_realizacion,
                    "total": documento.total_bruto,
                    "saldo_pendiente": documento.saldo_pendiente,
                    "credito_disponible": max(CERO, credito_disponible),
                    "lineas": lineas,
                }
            )
    return salida


@router.post("", response_model=NotaCreditoVista, status_code=201)
async def crear_nota(
    datos: NotaCreditoCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> NotaCreditoVista:
    permiso = (
        "ventas.notas_credito.emitir" if datos.tipo == "CLIENTE" else "compras.gestionar"
    )
    await asegurar_permiso(usuario, permiso, sesion)
    numero = await sesion.scalar(select(Sequence("secuencia_notas_credito").next_value()))
    if datos.tipo == "CLIENTE":
        origen = await sesion.scalar(
            select(VentaDocumento)
            .where(VentaDocumento.id == datos.documento_origen_id)
            .with_for_update()
        )
        if origen is None or origen.estado != "CONFIRMADO":
            raise HTTPException(409, "La venta no existe o no esta confirmada")
        socio_id, almacen_id = origen.cliente_id, origen.almacen_id
    else:
        origen = await sesion.scalar(
            select(FacturaCompra)
            .where(FacturaCompra.id == datos.documento_origen_id)
            .with_for_update()
        )
        if origen is None or origen.estado != "CONFIRMADO":
            raise HTTPException(409, "La factura de compra no existe o no esta confirmada")
        socio_id, almacen_id = origen.proveedor_id, origen.almacen_id
    preparados: list[tuple[object, Articulo, Decimal, Decimal, Decimal]] = []
    total = CERO
    for entrada in datos.lineas:
        modelo = VentaDocumentoDetalle if datos.tipo == "CLIENTE" else FacturaCompraDetalle
        detalle = await sesion.scalar(
            select(modelo).where(modelo.id == entrada.detalle_origen_id).with_for_update()
        )
        pertenece = detalle and (
            (datos.tipo == "CLIENTE" and detalle.venta_id == origen.id)
            or (datos.tipo == "PROVEEDOR" and detalle.factura_id == origen.id)
        )
        if not pertenece:
            raise HTTPException(409, "Un renglon no pertenece al comprobante seleccionado")
        disponible = detalle.cantidad_base - await cantidad_acreditada(
            datos.tipo, detalle.id, sesion
        )
        if entrada.cantidad_base > disponible:
            raise HTTPException(409, "La cantidad supera lo disponible para acreditar")
        articulo = await sesion.get(Articulo, detalle.articulo_id)
        unitario = (
            detalle.precio_unitario_bruto
            if datos.tipo == "CLIENTE"
            else detalle.costo_bruto_unitario
        )
        iva = detalle.porcentaje_iva if datos.tipo == "CLIENTE" else Decimal("0")
        subtotal = dinero(entrada.cantidad_base * unitario)
        total += subtotal
        preparados.append((detalle, articulo, entrada.cantidad_base, unitario, iva))
    total = dinero(datos.importe_narrativo if datos.modalidad == "NARRATIVA" else total)
    if total <= 0:
        raise HTTPException(409, "La nota de credito debe tener un importe mayor que cero")
    disponible_documento = dinero(
        origen.total_bruto - await total_acreditado(datos.tipo, origen.id, sesion)
    )
    if total > disponible_documento:
        raise HTTPException(
            409,
            f"La nota supera el credito disponible del comprobante ({disponible_documento})",
        )
    movimiento = (
        await nuevo_movimiento(sesion, usuario, f"NOTA_CREDITO_{datos.tipo}", numero, almacen_id)
        if datos.afecta_stock and any(x[1].habilitado_inventario for x in preparados)
        else None
    )
    referencia = f"NOTA DE CREDITO NC {numero:08d}"
    devolucion_cobro_id = None
    movimiento_caja_id = None
    if datos.tipo == "CLIENTE":
        numero_financiero = await sesion.scalar(select(Sequence("secuencia_cobros").next_value()))
        financiero = CobroDocumento(
            numero=numero_financiero,
            cliente_id=socio_id,
            estado="CONFIRMADO",
            total=total,
            usuario_id=usuario.id,
        )
        sesion.add(financiero)
        await sesion.flush()
        sesion.add(
            CobroMedioPago(
                cobro_id=financiero.id, medio="NOTA_CREDITO", importe=total, referencia=referencia
            )
        )
        aplicado = min(total, origen.saldo_pendiente)
        if aplicado > 0:
            sesion.add(
                ImputacionCobroVenta(
                    cobro_id=financiero.id,
                    venta_id=origen.id,
                    importe=aplicado,
                    estado="ACTIVA",
                    usuario_id=usuario.id,
                )
            )
            origen.saldo_pendiente = dinero(origen.saldo_pendiente - aplicado)
        excedente = dinero(total - aplicado)
        if datos.apertura_caja_id:
            if excedente <= 0:
                raise HTTPException(
                    409,
                    "La nota se aplica totalmente a deuda pendiente; "
                    "no existe importe para devolver",
                )
            apertura = await sesion.scalar(
                select(AperturaCaja)
                .where(AperturaCaja.id == datos.apertura_caja_id)
                .with_for_update()
            )
            if apertura is None or apertura.estado != "ABIERTA":
                raise HTTPException(409, "La caja seleccionada no existe o ya fue cerrada")
            if not usuario.es_administrador and apertura.usuario_id != usuario.id:
                raise HTTPException(403, "Solo puede registrar la devolucion en su propia caja")
            numero_devolucion = await sesion.scalar(
                select(Sequence("secuencia_cobros").next_value())
            )
            devolucion = CobroDocumento(
                numero=numero_devolucion,
                cliente_id=socio_id,
                estado="CONFIRMADO",
                total=-excedente,
                usuario_id=usuario.id,
            )
            sesion.add(devolucion)
            await sesion.flush()
            sesion.add(
                CobroMedioPago(
                    cobro_id=devolucion.id,
                    medio="DEVOLUCION_NC",
                    importe=-excedente,
                    referencia=f"{datos.medio_devolucion} | {referencia}",
                )
            )
            movimiento_caja = MovimientoCaja(
                apertura_caja_id=apertura.id,
                tipo="EGRESO",
                medio=datos.medio_devolucion,
                importe=excedente,
                concepto=f"DEVOLUCION {referencia}",
                estado="CONFIRMADO",
                usuario_id=usuario.id,
            )
            sesion.add(movimiento_caja)
            await sesion.flush()
            devolucion_cobro_id = devolucion.id
            movimiento_caja_id = movimiento_caja.id
        cobro_id, pago_id = financiero.id, None
    else:
        numero_financiero = await sesion.scalar(select(Sequence("secuencia_pagos").next_value()))
        financiero = PagoDocumento(
            numero=numero_financiero,
            proveedor_id=socio_id,
            estado="CONFIRMADO",
            total=total,
            observacion=referencia,
            usuario_id=usuario.id,
        )
        sesion.add(financiero)
        await sesion.flush()
        sesion.add(
            PagoMedioPago(
                pago_id=financiero.id,
                medio="NOTA_CREDITO",
                importe=total,
                referencia=datos.numero_externo,
            )
        )
        aplicado = min(total, origen.saldo_pendiente)
        if aplicado > 0:
            sesion.add(
                ImputacionPagoFactura(
                    pago_id=financiero.id,
                    factura_id=origen.id,
                    importe=aplicado,
                    estado="ACTIVA",
                    usuario_id=usuario.id,
                )
            )
            origen.saldo_pendiente = dinero(origen.saldo_pendiente - aplicado)
        cobro_id, pago_id = None, financiero.id
    nota = NotaCredito(
        numero=numero,
        tipo=datos.tipo,
        socio_id=socio_id,
        venta_id=origen.id if datos.tipo == "CLIENTE" else None,
        factura_compra_id=origen.id if datos.tipo == "PROVEEDOR" else None,
        almacen_id=almacen_id,
        numero_externo=datos.numero_externo,
        modalidad=datos.modalidad,
        motivo=datos.motivo,
        afecta_stock=movimiento is not None,
        total_bruto=total,
        estado="CONFIRMADO",
        movimiento_stock_id=movimiento.id if movimiento else None,
        cobro_id=cobro_id,
        pago_id=pago_id,
        devolucion_cobro_id=devolucion_cobro_id,
        movimiento_caja_id=movimiento_caja_id,
        usuario_id=usuario.id,
    )
    sesion.add(nota)
    await sesion.flush()
    for detalle, articulo, cantidad, unitario, iva in preparados:
        sesion.add(
            NotaCreditoDetalle(
                nota_credito_id=nota.id,
                articulo_id=articulo.id,
                venta_detalle_id=detalle.id if datos.tipo == "CLIENTE" else None,
                factura_detalle_id=detalle.id if datos.tipo == "PROVEEDOR" else None,
                cantidad_base=cantidad,
                importe_unitario_bruto=unitario,
                porcentaje_iva=iva,
                total_bruto=dinero(cantidad * unitario),
            )
        )
        if movimiento and articulo.habilitado_inventario:
            await impactar_stock(
                sesion,
                movimiento,
                articulo,
                almacen_id,
                cantidad if datos.tipo == "CLIENTE" else -cantidad,
            )
    await sesion.commit()
    await sesion.refresh(nota)
    return await nota_vista(nota, sesion)


@router.get("", response_model=list[NotaCreditoVista])
async def listar_notas(
    tipo: Literal["CLIENTE", "PROVEEDOR"] | None = None,
    limite: int = Query(100, ge=1, le=500),
    sesion: AsyncSession = Depends(obtener_sesion),
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> list[NotaCreditoVista]:
    permisos = (
        await obtener_codigos_permisos(usuario, sesion) if not usuario.es_administrador else set()
    )
    puede_clientes = usuario.es_administrador or "ventas.ver" in permisos
    puede_proveedores = usuario.es_administrador or "compras.ver" in permisos
    if tipo == "CLIENTE" and not puede_clientes:
        raise HTTPException(403, "Falta el permiso requerido: ventas.ver")
    if tipo == "PROVEEDOR" and not puede_proveedores:
        raise HTTPException(403, "Falta el permiso requerido: compras.ver")
    if not tipo and not (puede_clientes or puede_proveedores):
        raise HTTPException(403, "No posee permisos para consultar notas de credito")
    consulta = select(NotaCredito)
    if tipo:
        consulta = consulta.where(NotaCredito.tipo == tipo)
    elif not puede_clientes:
        consulta = consulta.where(NotaCredito.tipo == "PROVEEDOR")
    elif not puede_proveedores:
        consulta = consulta.where(NotaCredito.tipo == "CLIENTE")
    notas = list(
        await sesion.scalars(consulta.order_by(NotaCredito.fecha_realizacion.desc()).limit(limite))
    )
    return [await nota_vista(x, sesion) for x in notas]


@router.get("/{nota_id}/imprimir", response_class=HTMLResponse)
async def imprimir_nota(
    nota_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> HTMLResponse:
    nota = await sesion.get(NotaCredito, nota_id)
    if nota is None:
        raise HTTPException(404, "Nota de credito inexistente")
    await asegurar_permiso(
        usuario, "ventas.ver" if nota.tipo == "CLIENTE" else "compras.ver", sesion
    )
    vista = await nota_vista(nota, sesion)
    filas = "".join(
        "<tr>"
        f"<td>{escape(str(x['articulo_codigo']))} - "
        f"{escape(str(x['articulo_descripcion']))}</td>"
        f"<td>{x['cantidad_base']}</td>"
        f"<td>${Decimal(x['importe_unitario_bruto']):.2f}</td>"
        f"<td>${Decimal(x['total_bruto']):.2f}</td>"
        "</tr>"
        for x in vista.lineas
    )
    devolucion_texto = (
        f"<p>Devolucion por caja: {escape(vista.medio_devolucion or '')} - "
        f"${vista.importe_devolucion:.2f}</p>"
        if vista.importe_devolucion
        else ""
    )
    return HTMLResponse(
        f"""<!doctype html>
<html><head><meta charset='utf-8'><title>NC {vista.numero:08d}</title>
<style>
body{{font-family:Arial;margin:30px}} table{{width:100%;border-collapse:collapse}}
td,th{{padding:8px;border-bottom:1px solid #ddd;text-align:left}}
.total{{font-size:22px;text-align:right;font-weight:bold}}
@media print{{button{{display:none}}}}
</style></head><body><button onclick='print()'>Imprimir</button>
<h1>NOTA DE CREDITO NC {vista.numero:08d}</h1>
<p>{escape(vista.tipo)} · {escape(vista.socio_nombre)}</p>
<p>Comprobante original: {escape(vista.documento_origen)} ·
Almacen: {escape(vista.almacen_codigo)}</p>
<p>Modalidad: {escape(vista.modalidad)} · Motivo: {escape(vista.motivo)} ·
Afecta stock: {"SI" if vista.afecta_stock else "NO"}</p>
{devolucion_texto}
<table><thead><tr><th>Articulo</th><th>Cantidad</th><th>Importe</th><th>Total</th></tr>
</thead><tbody>{filas}</tbody></table>
<p class='total'>TOTAL ${vista.total_bruto:.2f}</p>
<p>DOCUMENTO INTERNO - NO VALIDO COMO COMPROBANTE FISCAL</p></body></html>"""
    )
