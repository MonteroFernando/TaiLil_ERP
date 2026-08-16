from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel


class EstadoSistema(BaseModel):
    estado: str
    servicio: str
    fecha_utc: datetime


router = APIRouter(prefix="/sistema", tags=["Sistema"])


@router.get("/estado", response_model=EstadoSistema)
async def obtener_estado() -> EstadoSistema:
    return EstadoSistema(
        estado="operativo",
        servicio="api",
        fecha_utc=datetime.now(UTC),
    )
