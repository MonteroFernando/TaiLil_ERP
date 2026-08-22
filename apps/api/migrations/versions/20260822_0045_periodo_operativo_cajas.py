"""Vincular aperturas y cierres a una fecha operativa.

Revision ID: 20260822_0045
Revises: 20260822_0044
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0045"
down_revision: str | None = "20260822_0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "aperturas_cajas",
        sa.Column("periodo_operativo", sa.Date(), nullable=True),
    )
    # Los historicos conservan su instante real y se asignan al dia comercial
    # argentino de la apertura. No se modifica ni elimina ningun movimiento.
    op.execute(
        """
        UPDATE aperturas_cajas
        SET periodo_operativo = (fecha_apertura AT TIME ZONE
                                 'America/Argentina/Buenos_Aires')::date
        WHERE periodo_operativo IS NULL
        """
    )
    op.alter_column(
        "aperturas_cajas",
        "periodo_operativo",
        existing_type=sa.Date(),
        nullable=False,
        server_default=sa.text("CURRENT_DATE"),
    )
    op.create_index(
        "ix_aperturas_cajas_periodo_operativo",
        "aperturas_cajas",
        ["periodo_operativo"],
    )


def downgrade() -> None:
    op.drop_index("ix_aperturas_cajas_periodo_operativo", table_name="aperturas_cajas")
    op.drop_column("aperturas_cajas", "periodo_operativo")
