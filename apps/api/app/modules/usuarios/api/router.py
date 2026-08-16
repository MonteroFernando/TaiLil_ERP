from datetime import UTC, datetime, timedelta
from hmac import compare_digest
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import configuracion
from app.core.normalizacion import normalizar_mayusculas
from app.core.seguridad import (
    crear_hash_contrasena,
    crear_hash_token,
    crear_token_acceso,
    crear_token_refresco,
    decodificar_token_refresco,
    verificar_contrasena,
)
from app.infrastructure.database.sesion import obtener_sesion
from app.modules.usuarios.api.administracion_schemas import MisPermisos
from app.modules.usuarios.api.dependencias import obtener_usuario_actual
from app.modules.usuarios.api.schemas import (
    CambioContrasena,
    Credenciales,
    Mensaje,
    ResultadoAutenticacion,
    UsuarioActual,
)
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Sesion, Usuario

router = APIRouter(prefix="/autenticacion", tags=["Autenticacion"])


def respuesta_usuario(usuario: Usuario) -> UsuarioActual:
    return UsuarioActual(
        id=usuario.id,
        nombre_usuario=usuario.nombre_usuario,
        es_administrador=usuario.es_administrador,
        debe_cambiar_contrasena=usuario.debe_cambiar_contrasena,
    )


def guardar_cookies(respuesta: Response, token_acceso: str, token_refresco: str) -> None:
    opciones = {
        "httponly": True,
        "secure": configuracion.cookie_segura,
        "samesite": configuracion.cookie_samesite,
        "path": "/",
    }
    respuesta.set_cookie(
        configuracion.cookie_acceso,
        token_acceso,
        max_age=configuracion.jwt_acceso_minutos * 60,
        **opciones,
    )
    respuesta.set_cookie(
        configuracion.cookie_refresco,
        token_refresco,
        max_age=configuracion.jwt_refresco_dias * 24 * 60 * 60,
        **opciones,
    )


def borrar_cookies(respuesta: Response) -> None:
    respuesta.delete_cookie(configuracion.cookie_acceso, path="/")
    respuesta.delete_cookie(configuracion.cookie_refresco, path="/")


@router.post("/iniciar-sesion", response_model=ResultadoAutenticacion)
async def iniciar_sesion(
    credenciales: Credenciales,
    request: Request,
    respuesta: Response,
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> ResultadoAutenticacion:
    usuario = await sesion_db.scalar(
        select(Usuario).where(
            Usuario.nombre_usuario == normalizar_mayusculas(credenciales.nombre_usuario)
        )
    )
    if usuario is None or not verificar_contrasena(
        credenciales.contrasena, usuario.contrasena_hash
    ):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="El usuario se encuentra inactivo")

    nueva_sesion = Sesion(
        usuario_id=usuario.id,
        refresh_token_hash="pendiente",
        fecha_expiracion=datetime.now(UTC) + timedelta(days=configuracion.jwt_refresco_dias),
        revocada=False,
        direccion_ip=request.client.host if request.client else None,
        agente_usuario=request.headers.get("user-agent"),
    )
    sesion_db.add(nueva_sesion)
    await sesion_db.flush()

    token_acceso = crear_token_acceso(usuario.id, nueva_sesion.id)
    token_refresco = crear_token_refresco(usuario.id, nueva_sesion.id)
    nueva_sesion.refresh_token_hash = crear_hash_token(token_refresco)
    await sesion_db.commit()
    guardar_cookies(respuesta, token_acceso, token_refresco)

    return ResultadoAutenticacion(
        mensaje="Sesion iniciada correctamente", usuario=respuesta_usuario(usuario)
    )


@router.post("/renovar", response_model=Mensaje)
async def renovar_sesion(
    respuesta: Response,
    token: str | None = Cookie(default=None, alias=configuracion.cookie_refresco),
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> Mensaje:
    if not token:
        raise HTTPException(status_code=401, detail="No se encontro una sesion renovable")
    try:
        contenido = decodificar_token_refresco(token)
        if contenido.get("tipo") != "refresco":
            raise ValueError("Tipo de token invalido")
        usuario_id = UUID(str(contenido["sub"]))
        sesion_id = UUID(str(contenido["sid"]))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=401, detail="El token de renovacion no es valido"
        ) from error

    sesion = await sesion_db.scalar(select(Sesion).where(Sesion.id == sesion_id))
    if (
        sesion is None
        or sesion.usuario_id != usuario_id
        or sesion.revocada
        or sesion.fecha_expiracion <= datetime.now(UTC)
        or not compare_digest(sesion.refresh_token_hash, crear_hash_token(token))
    ):
        raise HTTPException(status_code=401, detail="La sesion no puede renovarse")

    token_acceso = crear_token_acceso(usuario_id, sesion_id)
    token_refresco = crear_token_refresco(usuario_id, sesion_id)
    sesion.refresh_token_hash = crear_hash_token(token_refresco)
    sesion.fecha_ultimo_uso = datetime.now(UTC)
    sesion.fecha_expiracion = datetime.now(UTC) + timedelta(days=configuracion.jwt_refresco_dias)
    await sesion_db.commit()
    guardar_cookies(respuesta, token_acceso, token_refresco)
    return Mensaje(mensaje="Sesion renovada correctamente")


@router.post("/cerrar-sesion", response_model=Mensaje)
async def cerrar_sesion(
    respuesta: Response,
    token: str | None = Cookie(default=None, alias=configuracion.cookie_refresco),
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> Mensaje:
    if token:
        try:
            contenido = decodificar_token_refresco(token)
            sesion_id = UUID(str(contenido["sid"]))
            await sesion_db.execute(
                update(Sesion).where(Sesion.id == sesion_id).values(revocada=True)
            )
            await sesion_db.commit()
        except (jwt.PyJWTError, KeyError, TypeError, ValueError):
            pass
    borrar_cookies(respuesta)
    return Mensaje(mensaje="Sesion cerrada correctamente")


@router.get("/yo", response_model=UsuarioActual)
async def obtener_perfil(usuario: Usuario = Depends(obtener_usuario_actual)) -> UsuarioActual:
    return respuesta_usuario(usuario)


@router.get("/mis-permisos", response_model=MisPermisos)
async def listar_mis_permisos(
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> MisPermisos:
    return MisPermisos(permisos=await obtener_codigos_permisos(usuario, sesion_db))


@router.post("/cambiar-contrasena", response_model=Mensaje)
async def cambiar_contrasena(
    datos: CambioContrasena,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion_db: AsyncSession = Depends(obtener_sesion),
) -> Mensaje:
    if not verificar_contrasena(datos.contrasena_actual, usuario.contrasena_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if datos.contrasena_actual == datos.contrasena_nueva:
        raise HTTPException(status_code=400, detail="La contraseña nueva debe ser diferente")

    usuario.contrasena_hash = crear_hash_contrasena(datos.contrasena_nueva)
    usuario.debe_cambiar_contrasena = False
    await sesion_db.commit()
    return Mensaje(mensaje="Contraseña actualizada correctamente")
