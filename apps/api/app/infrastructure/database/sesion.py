from collections.abc import AsyncIterator

from sqlalchemy import String, event, inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.normalizacion import normalizar_mayusculas

# Estos valores son secretos o contratos tecnicos y no deben alterarse.
CAMPOS_TECNICOS_EXCLUIDOS = {
    "articulos.tipo_articulo",
    "articulos_codigos_barra.modo_contenido",
    "socios.tipo_persona",
    "socios_domicilios.tipo",
    "socios_domicilios.rol",
    "cuentas_corrientes_ventas.temporalidad",
    "permisos.codigo",
    "permisos.modulo",
    "permisos.accion",
    "sesiones.agente_usuario",
    "sesiones.direccion_ip",
}


def _es_campo_excluido(tabla: str, columna: str) -> bool:
    nombre = columna.lower()
    return (
        f"{tabla}.{columna}" in CAMPOS_TECNICOS_EXCLUIDOS
        or "contrasena" in nombre
        or "password" in nombre
        or "token" in nombre
        or "email" in nombre
        or nombre.endswith("_hash")
    )


@event.listens_for(Session, "before_flush")
def normalizar_textos_antes_de_guardar(sesion: Session, *_: object) -> None:
    """Normaliza todos los String/Text de negocio nuevos o modificados."""
    for instancia in sesion.new.union(sesion.dirty):
        mapper = inspect(instancia).mapper
        for atributo in mapper.column_attrs:
            columna = atributo.columns[0]
            if not isinstance(columna.type, String):
                continue
            valor = getattr(instancia, atributo.key, None)
            if "email" in columna.name.lower() and isinstance(valor, str):
                setattr(instancia, atributo.key, valor.strip().lower())
                continue
            if _es_campo_excluido(mapper.local_table.name, columna.name):
                continue
            if isinstance(valor, str):
                setattr(instancia, atributo.key, normalizar_mayusculas(valor))


motor = create_async_engine(configuracion.url_base_datos, pool_pre_ping=True)
fabrica_sesiones = async_sessionmaker(motor, expire_on_commit=False)


async def obtener_sesion() -> AsyncIterator[AsyncSession]:
    async with fabrica_sesiones() as sesion:
        yield sesion
