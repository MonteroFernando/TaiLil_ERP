from fastapi import APIRouter

from app.modules.articulos.api.router import router as articulos_router
from app.modules.dashboard.api.router import router as dashboard_router
from app.modules.sistema.api.router import router as sistema_router
from app.modules.usuarios.api.administracion_router import router as administracion_accesos_router
from app.modules.usuarios.api.router import router as autenticacion_router

api_router = APIRouter()
api_router.include_router(sistema_router)
api_router.include_router(autenticacion_router)
api_router.include_router(administracion_accesos_router)
api_router.include_router(articulos_router)
api_router.include_router(dashboard_router)
