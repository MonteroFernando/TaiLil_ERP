from uuid import UUID

from pydantic import BaseModel, Field


class PermisoVista(BaseModel):
    id: UUID
    codigo: str
    modulo: str
    accion: str
    descripcion: str


class PerfilCrear(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str | None = Field(default=None, max_length=500)
    permiso_ids: list[UUID] = Field(default_factory=list)


class PerfilActualizar(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str | None = Field(default=None, max_length=500)
    activo: bool = True
    permiso_ids: list[UUID] = Field(default_factory=list)


class PerfilVista(BaseModel):
    id: UUID
    nombre: str
    descripcion: str | None
    activo: bool
    es_sistema: bool
    permiso_ids: list[UUID]


class UsuarioCrear(BaseModel):
    nombre_usuario: str = Field(min_length=3, max_length=80)
    contrasena_temporal: str = Field(min_length=10, max_length=200)
    es_administrador: bool = False
    perfil_ids: list[UUID] = Field(default_factory=list)
    permiso_ids: list[UUID] = Field(default_factory=list)


class AccesosUsuarioActualizar(BaseModel):
    activo: bool = True
    es_administrador: bool = False
    perfil_ids: list[UUID] = Field(default_factory=list)
    permiso_ids: list[UUID] = Field(default_factory=list)


class RestablecerContrasenaUsuario(BaseModel):
    contrasena_temporal: str = Field(min_length=10, max_length=200)


class UsuarioAdministracionVista(BaseModel):
    id: UUID
    nombre_usuario: str
    activo: bool
    es_administrador: bool
    debe_cambiar_contrasena: bool
    perfil_ids: list[UUID]
    permiso_ids: list[UUID]


class MisPermisos(BaseModel):
    permisos: list[str]
