from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.infrastructure.models import (
    CobroDocumento,
    CobroMedioPago,
    NotaCredito,
    NotaCreditoDetalle,
    Socio,
    VentaDocumento,
    VentaDocumentoDetalle,
)
from app.modules.tesoreria.infrastructure.models import (
    MovimientoCaja,
    PagoDocumento,
    PagoMedioPago,
)
from app.modules.usuarios.api.dependencias import requerir_permiso

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
                CobroMedioPago.medio != "NOTA_CREDITO",
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
    filas = (
        [
            {
                "fecha": c.fecha_realizacion,
                "sentido": "INGRESO",
                "origen": f"COBRO #{c.numero}",
                "medio": m.medio,
                "concepto": m.referencia or "Cobro de cliente",
                "importe": m.importe,
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
            }
            for p, m in pagos
        ]
        + [
            {
                "fecha": m.fecha_realizacion,
                "sentido": m.tipo,
                "origen": "MOVIMIENTO DE CAJA",
                "medio": m.medio,
                "concepto": m.concepto,
                "importe": m.importe,
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
    limite: int = Query(500, ge=1, le=1000),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> dict:
    inicio, fin = rango(desde, hasta)
    costo = func.coalesce(
        func.sum(VentaDocumentoDetalle.cantidad_base * VentaDocumentoDetalle.costo_unitario_bruto),
        0,
    )
    consulta = (
        select(VentaDocumento, Socio, costo.label("costo"))
        .join(Socio, Socio.id == VentaDocumento.cliente_id)
        .join(VentaDocumentoDetalle, VentaDocumentoDetalle.venta_id == VentaDocumento.id)
        .where(
            VentaDocumento.estado == "CONFIRMADO",
            VentaDocumento.fecha_realizacion >= inicio,
            VentaDocumento.fecha_realizacion < fin,
        )
        .group_by(VentaDocumento.id, Socio.id)
        .order_by(VentaDocumento.fecha_realizacion)
        .limit(limite)
    )
    if cliente_id:
        consulta = consulta.where(VentaDocumento.cliente_id == cliente_id)
    filas = (await sesion.execute(consulta)).all()
    ventas = []
    for venta, socio, costo_bruto in filas:
        credito = importe(
            await sesion.scalar(
                select(func.coalesce(func.sum(NotaCredito.total_bruto), 0)).where(
                    NotaCredito.venta_id == venta.id,
                    NotaCredito.tipo == "CLIENTE",
                    NotaCredito.estado == "CONFIRMADO",
                )
            )
        )
        costo_devuelto = importe(
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
                .join(NotaCredito, NotaCredito.id == NotaCreditoDetalle.nota_credito_id)
                .where(
                    NotaCredito.venta_id == venta.id,
                    NotaCredito.estado == "CONFIRMADO",
                )
            )
        )
        venta_original = importe(venta.total_bruto)
        total = importe(venta_original - credito)
        costo_total = importe(Decimal(costo_bruto) - costo_devuelto)
        margen = total - costo_total
        ventas.append(
            {
                "id": venta.id,
                "fecha": venta.fecha_realizacion,
                "comprobante": f"{venta.letra} {venta.numero or 0:08d}",
                "cliente_id": socio.id,
                "cliente": socio.razon_social,
                "venta_original": venta_original,
                "venta_bruta": total,
                "notas_credito": credito,
                "costo_bruto": costo_total,
                "margen_bruto": margen,
                "margen_porcentual": importe((margen / total * 100) if total else 0),
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
    }
