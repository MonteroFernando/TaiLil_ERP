from uuid import UUID

from pydantic import BaseModel, Field


class Credenciales(BaseModel):
    nombre_usuario: str = Field(min_length=1, max_length=80)
    contrasena: str = Field(min_length=1, max_length=200)


class UsuarioActual(BaseModel):
    id: UUID
    nombre_usuario: str
    es_administrador: bool
    debe_cambiar_contrasena: bool


class ResultadoAutenticacion(BaseModel):
    mensaje: str
    usuario: UsuarioActual


class CambioContrasena(BaseModel):
    contrasena_actual: str = Field(min_length=1, max_length=200)
    contrasena_nueva: str = Field(min_length=10, max_length=200)


class Mensaje(BaseModel):
    mensaje: str
