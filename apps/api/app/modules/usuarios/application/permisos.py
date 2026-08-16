from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.usuarios.infrastructure.models import (
    PerfilAcceso,
    PerfilPermiso,
    Permiso,
    Usuario,
    UsuarioPerfil,
    UsuarioPermiso,
)


async def obtener_codigos_permisos(usuario: Usuario, sesion: AsyncSession) -> list[str]:
    if usuario.es_administrador:
        resultado = await sesion.scalars(select(Permiso.codigo).order_by(Permiso.codigo))
        return list(resultado)

    permisos_directos = (
        select(Permiso.codigo)
        .join(UsuarioPermiso, UsuarioPermiso.permiso_id == Permiso.id)
        .where(UsuarioPermiso.usuario_id == usuario.id)
    )
    permisos_por_perfil = (
        select(Permiso.codigo)
        .join(PerfilPermiso, PerfilPermiso.permiso_id == Permiso.id)
        .join(UsuarioPerfil, UsuarioPerfil.perfil_id == PerfilPermiso.perfil_id)
        .join(PerfilAcceso, PerfilAcceso.id == UsuarioPerfil.perfil_id)
        .where(UsuarioPerfil.usuario_id == usuario.id, PerfilAcceso.activo.is_(True))
    )
    codigos = set((await sesion.scalars(permisos_directos)).all())
    codigos.update((await sesion.scalars(permisos_por_perfil)).all())
    return sorted(codigos)
