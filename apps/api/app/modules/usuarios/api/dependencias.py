from uuid import UUID

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import configuracion
from app.core.seguridad import decodificar_token_acceso
from app.infrastructure.database.sesion import obtener_sesion
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Sesion, Usuario


async def obtener_usuario_actual(
    token: str | None = Cookie(default=None, alias=configuracion.cookie_acceso),
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> Usuario:
    excepcion = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="La sesion no es valida o ha expirado",
    )
    if not token:
        raise excepcion

    try:
        contenido = decodificar_token_acceso(token)
        if contenido.get("tipo") != "acceso":
            raise excepcion
        usuario_id = UUID(str(contenido["sub"]))
        sesion_id = UUID(str(contenido["sid"]))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
        raise excepcion from error

    consulta = (
        select(Usuario)
        .join(Sesion, Sesion.usuario_id == Usuario.id)
        .where(
            Usuario.id == usuario_id,
            Usuario.activo.is_(True),
            Sesion.id == sesion_id,
            Sesion.revocada.is_(False),
        )
    )
    usuario = await sesion_db.scalar(consulta)
    if usuario is None:
        raise excepcion
    return usuario


async def requerir_administrador(
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> Usuario:
    if not usuario.es_administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta operacion requiere permisos de administrador",
        )
    return usuario


def requerir_permiso(codigo: str):
    async def dependencia(
        usuario: Usuario = Depends(obtener_usuario_actual),
        sesion_db: AsyncSession = Depends(obtener_sesion),
    ) -> Usuario:
        if usuario.es_administrador:
            return usuario
        permisos = await obtener_codigos_permisos(usuario, sesion_db)
        if codigo not in permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Falta el permiso requerido: {codigo}",
            )
        return usuario

    return dependencia


def requerir_alguno_de(*codigos: str):
    """Autoriza cuando el usuario posee al menos uno de los permisos indicados."""

    async def dependencia(
        usuario: Usuario = Depends(obtener_usuario_actual),
        sesion_db: AsyncSession = Depends(obtener_sesion),
    ) -> Usuario:
        if usuario.es_administrador:
            return usuario
        permisos = set(await obtener_codigos_permisos(usuario, sesion_db))
        if not permisos.intersection(codigos):
            esperados = " o ".join(codigos)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Falta alguno de los permisos requeridos: {esperados}",
            )
        return usuario

    return dependencia
