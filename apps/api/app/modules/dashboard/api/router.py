from datetime import UTC, datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.infrastructure.models import (
    AperturaCaja,
    CobroDocumento,
    CobroMedioPago,
    ImputacionCobroVenta,
    VentaDocumento,
)
from app.modules.usuarios.api.dependencias import obtener_usuario_actual
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def zona_horaria_buenos_aires() -> ZoneInfo:
    """Devuelve la zona operativa; tzdata es obligatoria en instalaciones Windows."""
    try:
        return ZoneInfo("America/Argentina/Buenos_Aires")
    except ZoneInfoNotFoundError as error:
        raise RuntimeError(
            "No esta instalada la dependencia tzdata requerida para la zona horaria argentina"
        ) from error


class TarjetaDashboard(BaseModel):
    codigo: str
    titulo: str
    descripcion: str
    modulo: str
    tipo: Literal["actividad", "cantidad", "dinero", "estado"]
    disponible: bool = False
    valor: int | float | str | None = None


class DashboardVista(BaseModel):
    tarjetas: list[TarjetaDashboard]


DEFINICIONES = [
    (
        "ultimos_movimientos",
        "Ultimos movimientos",
        "Actividad reciente del usuario",
        "general",
        "actividad",
        None,
    ),
    (
        "ventas_dia",
        "Ventas del dia",
        "Cantidad vendida durante la jornada",
        "ventas",
        "cantidad",
        "ventas.ver",
    ),
    (
        "borradores_pos",
        "Borradores POS",
        "Presupuestos pendientes",
        "ventas",
        "cantidad",
        "ventas.ver",
    ),
    ("caja_abierta", "Caja abierta", "Turno de caja actual", "ventas", "estado", "ventas.ver"),
    (
        "efectivo_caja",
        "Efectivo esperado",
        "Inicial mas cobros en efectivo",
        "ventas",
        "dinero",
        "ventas.ver",
    ),
    (
        "gastos_dia",
        "Gastos del dia",
        "Gastos registrados durante la jornada",
        "finanzas",
        "dinero",
        "finanzas.ver",
    ),
    (
        "cashflow",
        "Cashflow",
        "Entradas, salidas y flujo proyectado",
        "tesoreria",
        "dinero",
        "tesoreria.ver",
    ),
    (
        "estado_stock",
        "Stock y almacenes",
        "Existencias, alertas y transferencias",
        "inventario",
        "estado",
        "inventario.ver",
    ),
]


@router.get("", response_model=DashboardVista)
async def obtener_dashboard(
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> DashboardVista:
    permisos = set(await obtener_codigos_permisos(usuario, sesion))
    tarjetas = [
        TarjetaDashboard(
            codigo=codigo,
            titulo=titulo,
            descripcion=descripcion,
            modulo=modulo,
            tipo=tipo,
        )
        for codigo, titulo, descripcion, modulo, tipo, permiso in DEFINICIONES
        if permiso is None or permiso in permisos
    ]
    inicio_local = (
        datetime.now(zona_horaria_buenos_aires())
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(UTC)
    )
    ventas_dia = await sesion.scalar(
        select(func.coalesce(func.sum(VentaDocumento.total_bruto), 0)).where(
            VentaDocumento.estado == "CONFIRMADO",
            VentaDocumento.fecha_realizacion >= inicio_local,
        )
    )
    borradores = await sesion.scalar(
        select(func.count(VentaDocumento.id)).where(VentaDocumento.estado == "BORRADOR")
    )
    apertura = await sesion.scalar(
        select(AperturaCaja).where(
            AperturaCaja.usuario_id == usuario.id, AperturaCaja.estado == "ABIERTA"
        )
    )
    efectivo = apertura.efectivo_inicial if apertura else 0
    if apertura:
        cobros_efectivo = await sesion.scalar(
            select(func.coalesce(func.sum(CobroMedioPago.importe), 0))
            .join(CobroDocumento, CobroDocumento.id == CobroMedioPago.cobro_id)
            .join(ImputacionCobroVenta, ImputacionCobroVenta.cobro_id == CobroDocumento.id)
            .join(VentaDocumento, VentaDocumento.id == ImputacionCobroVenta.venta_id)
            .where(
                VentaDocumento.apertura_caja_id == apertura.id,
                CobroMedioPago.medio == "EFECTIVO",
                CobroDocumento.estado == "CONFIRMADO",
            )
        )
        efectivo += cobros_efectivo
    valores = {
        "ventas_dia": f"${ventas_dia:.2f}",
        "borradores_pos": int(borradores or 0),
        "caja_abierta": "ABIERTA" if apertura else "SIN APERTURA",
        "efectivo_caja": f"${efectivo:.2f}",
    }
    for tarjeta in tarjetas:
        if tarjeta.codigo in valores:
            tarjeta.valor = valores[tarjeta.codigo]
            tarjeta.disponible = True
    return DashboardVista(tarjetas=tarjetas)
