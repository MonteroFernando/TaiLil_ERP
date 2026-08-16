from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    nombre_usuario: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    contrasena_hash: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    es_administrador: Mapped[bool] = mapped_column(Boolean, default=False)
    debe_cambiar_contrasena: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sesiones: Mapped[list["Sesion"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )


class Sesion(Base):
    __tablename__ = "sesiones"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    fecha_expiracion: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revocada: Mapped[bool] = mapped_column(Boolean, default=False)
    direccion_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    agente_usuario: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_ultimo_uso: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    usuario: Mapped[Usuario] = relationship(back_populates="sesiones")


class Permiso(Base):
    __tablename__ = "permisos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    modulo: Mapped[str] = mapped_column(String(80), index=True)
    accion: Mapped[str] = mapped_column(String(80))
    descripcion: Mapped[str] = mapped_column(Text)


class PerfilAcceso(Base):
    __tablename__ = "perfiles_acceso"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    es_sistema: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PerfilPermiso(Base):
    __tablename__ = "perfiles_permisos"

    perfil_id: Mapped[UUID] = mapped_column(
        ForeignKey("perfiles_acceso.id", ondelete="CASCADE"), primary_key=True
    )
    permiso_id: Mapped[UUID] = mapped_column(
        ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True
    )


class UsuarioPerfil(Base):
    __tablename__ = "usuarios_perfiles"

    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    perfil_id: Mapped[UUID] = mapped_column(
        ForeignKey("perfiles_acceso.id", ondelete="CASCADE"), primary_key=True
    )


class UsuarioPermiso(Base):
    __tablename__ = "usuarios_permisos"

    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    permiso_id: Mapped[UUID] = mapped_column(
        ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True
    )
