"""Crear usuarios y sesiones.

Revision ID: 20260815_0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre_usuario", sa.String(length=80), nullable=False),
        sa.Column("contrasena_hash", sa.String(length=255), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("es_administrador", sa.Boolean(), nullable=False),
        sa.Column("debe_cambiar_contrasena", sa.Boolean(), nullable=False),
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "fecha_modificacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_usuarios"),
        sa.UniqueConstraint("nombre_usuario", name="uq_usuarios_nombre_usuario"),
    )
    op.create_index("ix_usuarios_nombre_usuario", "usuarios", ["nombre_usuario"])

    op.create_table(
        "sesiones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("fecha_expiracion", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revocada", sa.Boolean(), nullable=False),
        sa.Column("direccion_ip", sa.String(length=45), nullable=True),
        sa.Column("agente_usuario", sa.String(length=500), nullable=True),
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("fecha_ultimo_uso", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            name="fk_sesiones_usuario_id_usuarios",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sesiones"),
        sa.UniqueConstraint("refresh_token_hash", name="uq_sesiones_refresh_token_hash"),
    )
    op.create_index("ix_sesiones_usuario_id", "sesiones", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_sesiones_usuario_id", table_name="sesiones")
    op.drop_table("sesiones")
    op.drop_index("ix_usuarios_nombre_usuario", table_name="usuarios")
    op.drop_table("usuarios")
