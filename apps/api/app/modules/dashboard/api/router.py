from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.sesion import obtener_sesion
from app.modules.usuarios.api.dependencias import obtener_usuario_actual
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


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
    return DashboardVista(tarjetas=tarjetas)
