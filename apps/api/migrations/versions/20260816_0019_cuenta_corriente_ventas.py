"""Agregar configuracion de cuenta corriente de ventas.

Revision ID: 20260816_0019
Revises: 20260816_0018
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0019"
down_revision: str | None = "20260816_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISO_ID = UUID("10000000-0000-0000-0000-000000000015")


def upgrade() -> None:
    op.create_table(
        "cuentas_corrientes_ventas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("socio_id", sa.Uuid(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.Column("limite_deuda", sa.Numeric(18, 2), nullable=False),
        sa.Column("limite_periodo", sa.Numeric(18, 2), nullable=False),
        sa.Column("temporalidad", sa.String(20), nullable=False),
        sa.Column("dias_maximos_deuda", sa.Integer(), nullable=False),
        sa.CheckConstraint("limite_deuda >= 0", name="ck_ccv_limite_deuda"),
        sa.CheckConstraint("limite_periodo >= 0", name="ck_ccv_limite_periodo"),
        sa.CheckConstraint("limite_periodo <= limite_deuda", name="ck_ccv_periodo_valido"),
        sa.CheckConstraint("dias_maximos_deuda >= 0", name="ck_ccv_dias_deuda"),
        sa.CheckConstraint(
            "temporalidad IN ('diaria','semanal','mensual')", name="ck_ccv_temporalidad"
        ),
        sa.ForeignKeyConstraint(
            ["socio_id"], ["socios.id"], name="fk_ccv_socio", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_cuentas_corrientes_ventas"),
        sa.UniqueConstraint("socio_id", name="uq_ccv_socio"),
    )
    op.create_index("ix_ccv_socio", "cuentas_corrientes_ventas", ["socio_id"])
    op.execute(
        sa.text(
            "INSERT INTO permisos (id,codigo,modulo,accion,descripcion) VALUES "
            "(:id,'ventas.cuenta_corriente.configurar','ventas','configurar_cuenta_corriente',"
            "'Configurar limites y condiciones de cuenta corriente de ventas')"
        ).bindparams(id=PERMISO_ID)
    )
    op.execute(
        sa.text(
            "INSERT INTO perfiles_permisos (perfil_id,permiso_id) "
            "SELECT id,:permiso FROM perfiles_acceso WHERE es_sistema=true "
            "ON CONFLICT DO NOTHING"
        ).bindparams(permiso=PERMISO_ID)
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM permisos WHERE id=:id").bindparams(id=PERMISO_ID))
    op.drop_index("ix_ccv_socio", table_name="cuentas_corrientes_ventas")
    op.drop_table("cuentas_corrientes_ventas")
