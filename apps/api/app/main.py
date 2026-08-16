from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import configuracion


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    """Punto central para inicializar y cerrar recursos compartidos."""
    yield


app = FastAPI(
    title=configuracion.nombre_aplicacion,
    debug=configuracion.modo_debug,
    version="0.1.0",
    docs_url="/docs" if configuracion.modo_debug else None,
    redoc_url="/redoc" if configuracion.modo_debug else None,
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configuracion.origenes_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
