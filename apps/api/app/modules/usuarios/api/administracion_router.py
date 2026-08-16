from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.normalizacion import normalizar_mayusculas
from app.core.seguridad import crear_hash_contrasena
from app.infrastructure.database.sesion import obtener_sesion
from app.modules.usuarios.api.administracion_schemas import (
    AccesosUsuarioActualizar,
    PerfilActualizar,
    PerfilCrear,
    PerfilVista,
    PermisoVista,
    RestablecerContrasenaUsuario,
    UsuarioAdministracionVista,
    UsuarioCrear,
)
from app.modules.usuarios.api.dependencias import requerir_administrador
from app.modules.usuarios.infrastructure.models import (
    PerfilAcceso,
    PerfilPermiso,
    Permiso,
    Sesion,
    Usuario,
    UsuarioPerfil,
    UsuarioPermiso,
)

router = APIRouter(
    prefix="/administracion/accesos",
    tags=["Administracion de accesos"],
    dependencies=[Depends(requerir_administrador)],
)


async def perfil_vista(perfil: PerfilAcceso, sesion: AsyncSession) -> PerfilVista:
    permiso_ids = list(
        await sesion.scalars(
            select(PerfilPermiso.permiso_id).where(PerfilPermiso.perfil_id == perfil.id)
        )
    )
    return PerfilVista(
        id=perfil.id,
        nombre=perfil.nombre,
        descripcion=perfil.descripcion,
        activo=perfil.activo,
        es_sistema=perfil.es_sistema,
        permiso_ids=permiso_ids,
    )


async def usuario_vista(usuario: Usuario, sesion: AsyncSession) -> UsuarioAdministracionVista:
    perfiles = list(
        await sesion.scalars(
            select(UsuarioPerfil.perfil_id).where(UsuarioPerfil.usuario_id == usuario.id)
        )
    )
    permisos = list(
        await sesion.scalars(
            select(UsuarioPermiso.permiso_id).where(UsuarioPermiso.usuario_id == usuario.id)
        )
    )
    return UsuarioAdministracionVista(
        id=usuario.id,
        nombre_usuario=usuario.nombre_usuario,
        activo=usuario.activo,
        es_administrador=usuario.es_administrador,
        debe_cambiar_contrasena=usuario.debe_cambiar_contrasena,
        perfil_ids=perfiles,
        permiso_ids=permisos,
    )


async def validar_ids(
    sesion: AsyncSession, modelo: type[PerfilAcceso] | type[Permiso], ids: list[UUID]
) -> None:
    ids_unicos = set(ids)
    if not ids_unicos:
        return
    encontrados = set(await sesion.scalars(select(modelo.id).where(modelo.id.in_(ids_unicos))))
    if encontrados != ids_unicos:
        raise HTTPException(
            status_code=400, detail="Se recibieron perfiles o permisos inexistentes"
        )


@router.get("/permisos", response_model=list[PermisoVista])
async def listar_permisos(sesion: AsyncSession = Depends(obtener_sesion)) -> list[Permiso]:
    return list(await sesion.scalars(select(Permiso).order_by(Permiso.modulo, Permiso.accion)))


@router.get("/perfiles", response_model=list[PerfilVista])
async def listar_perfiles(sesion: AsyncSession = Depends(obtener_sesion)) -> list[PerfilVista]:
    perfiles = list(await sesion.scalars(select(PerfilAcceso).order_by(PerfilAcceso.nombre)))
    return [await perfil_vista(perfil, sesion) for perfil in perfiles]


@router.post("/perfiles", response_model=PerfilVista, status_code=status.HTTP_201_CREATED)
async def crear_perfil(
    datos: PerfilCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> PerfilVista:
    nombre = normalizar_mayusculas(datos.nombre)
    if await sesion.scalar(select(PerfilAcceso).where(PerfilAcceso.nombre == nombre)):
        raise HTTPException(status_code=409, detail="Ya existe un perfil con ese nombre")
    await validar_ids(sesion, Permiso, datos.permiso_ids)
    perfil = PerfilAcceso(
        nombre=nombre, descripcion=datos.descripcion, activo=True, es_sistema=False
    )
    sesion.add(perfil)
    await sesion.flush()
    sesion.add_all(
        [PerfilPermiso(perfil_id=perfil.id, permiso_id=i) for i in set(datos.permiso_ids)]
    )
    await sesion.commit()
    return await perfil_vista(perfil, sesion)


@router.put("/perfiles/{perfil_id}", response_model=PerfilVista)
async def actualizar_perfil(
    perfil_id: UUID, datos: PerfilActualizar, sesion: AsyncSession = Depends(obtener_sesion)
) -> PerfilVista:
    perfil = await sesion.get(PerfilAcceso, perfil_id)
    if perfil is None:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    if perfil.es_sistema:
        raise HTTPException(
            status_code=400, detail="Los perfiles del sistema no pueden modificarse"
        )
    await validar_ids(sesion, Permiso, datos.permiso_ids)
    perfil.nombre = normalizar_mayusculas(datos.nombre)
    perfil.descripcion = datos.descripcion
    perfil.activo = datos.activo
    await sesion.execute(delete(PerfilPermiso).where(PerfilPermiso.perfil_id == perfil.id))
    sesion.add_all(
        [PerfilPermiso(perfil_id=perfil.id, permiso_id=i) for i in set(datos.permiso_ids)]
    )
    await sesion.commit()
    return await perfil_vista(perfil, sesion)


@router.get("/usuarios", response_model=list[UsuarioAdministracionVista])
async def listar_usuarios(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[UsuarioAdministracionVista]:
    usuarios = list(await sesion.scalars(select(Usuario).order_by(Usuario.nombre_usuario)))
    return [await usuario_vista(usuario, sesion) for usuario in usuarios]


@router.post(
    "/usuarios", response_model=UsuarioAdministracionVista, status_code=status.HTTP_201_CREATED
)
async def crear_usuario(
    datos: UsuarioCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> UsuarioAdministracionVista:
    nombre = normalizar_mayusculas(datos.nombre_usuario)
    if await sesion.scalar(select(Usuario).where(Usuario.nombre_usuario == nombre)):
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")
    await validar_ids(sesion, PerfilAcceso, datos.perfil_ids)
    await validar_ids(sesion, Permiso, datos.permiso_ids)
    usuario = Usuario(
        nombre_usuario=nombre,
        contrasena_hash=crear_hash_contrasena(datos.contrasena_temporal),
        activo=True,
        es_administrador=datos.es_administrador,
        debe_cambiar_contrasena=True,
    )
    sesion.add(usuario)
    await sesion.flush()
    sesion.add_all(
        [UsuarioPerfil(usuario_id=usuario.id, perfil_id=i) for i in set(datos.perfil_ids)]
    )
    sesion.add_all(
        [UsuarioPermiso(usuario_id=usuario.id, permiso_id=i) for i in set(datos.permiso_ids)]
    )
    await sesion.commit()
    return await usuario_vista(usuario, sesion)


@router.put("/usuarios/{usuario_id}/accesos", response_model=UsuarioAdministracionVista)
async def actualizar_accesos_usuario(
    usuario_id: UUID,
    datos: AccesosUsuarioActualizar,
    administrador_actual: Usuario = Depends(requerir_administrador),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> UsuarioAdministracionVista:
    usuario = await sesion.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.id == administrador_actual.id and (not datos.activo or not datos.es_administrador):
        raise HTTPException(
            status_code=400,
            detail="No puedes desactivar ni quitar tu propio acceso de administrador",
        )
    await validar_ids(sesion, PerfilAcceso, datos.perfil_ids)
    await validar_ids(sesion, Permiso, datos.permiso_ids)
    usuario.activo = datos.activo
    usuario.es_administrador = datos.es_administrador
    await sesion.execute(delete(UsuarioPerfil).where(UsuarioPerfil.usuario_id == usuario.id))
    await sesion.execute(delete(UsuarioPermiso).where(UsuarioPermiso.usuario_id == usuario.id))
    sesion.add_all(
        [UsuarioPerfil(usuario_id=usuario.id, perfil_id=i) for i in set(datos.perfil_ids)]
    )
    sesion.add_all(
        [UsuarioPermiso(usuario_id=usuario.id, permiso_id=i) for i in set(datos.permiso_ids)]
    )
    await sesion.commit()
    return await usuario_vista(usuario, sesion)


@router.post(
    "/usuarios/{usuario_id}/restablecer-contrasena", status_code=status.HTTP_204_NO_CONTENT
)
async def restablecer_contrasena_usuario(
    usuario_id: UUID,
    datos: RestablecerContrasenaUsuario,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> None:
    usuario = await sesion.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.contrasena_hash = crear_hash_contrasena(datos.contrasena_temporal)
    usuario.debe_cambiar_contrasena = True
    await sesion.execute(
        update(Sesion).where(Sesion.usuario_id == usuario.id).values(revocada=True)
    )
    await sesion.commit()


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_usuario(
    usuario_id: UUID,
    administrador_actual: Usuario = Depends(requerir_administrador),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> None:
    if usuario_id == administrador_actual.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    usuario = await sesion.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Eliminacion logica: conserva auditoria y relaciones historicas.
    usuario.activo = False
    await sesion.execute(
        update(Sesion).where(Sesion.usuario_id == usuario.id).values(revocada=True)
    )
    await sesion.commit()
