import asyncio

from sqlalchemy import select

from app.core.config import configuracion
from app.core.normalizacion import normalizar_mayusculas
from app.core.seguridad import crear_hash_contrasena
from app.infrastructure.database.sesion import fabrica_sesiones
from app.modules.usuarios.infrastructure.models import Usuario


async def crear_administrador() -> None:
    usuario_inicial = normalizar_mayusculas(configuracion.administrador_inicial_usuario)
    contrasena_inicial = configuracion.administrador_inicial_contrasena

    if not usuario_inicial or not contrasena_inicial:
        raise RuntimeError("Defina INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD en .env")

    async with fabrica_sesiones() as sesion:
        existente = await sesion.scalar(
            select(Usuario).where(Usuario.nombre_usuario == usuario_inicial)
        )
        if existente is not None:
            print(f"El usuario '{usuario_inicial}' ya existe; no se realizaron cambios.")
            return

        sesion.add(
            Usuario(
                nombre_usuario=usuario_inicial,
                contrasena_hash=crear_hash_contrasena(contrasena_inicial),
                activo=True,
                es_administrador=True,
                debe_cambiar_contrasena=True,
            )
        )
        await sesion.commit()
        print(f"Administrador inicial '{usuario_inicial}' creado correctamente.")


if __name__ == "__main__":
    asyncio.run(crear_administrador())
