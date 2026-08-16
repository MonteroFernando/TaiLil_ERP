"""Retirar la fecha adicional de movimientos de stock.

Revision ID: 20260816_0027
Revises: 20260816_0026
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0027"
down_revision: str | None = "20260816_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_movimientos_stock_fecha_creacion", table_name="movimientos_stock")
    op.drop_column("movimientos_stock", "fecha_creacion")


def downgrade() -> None:
    op.add_column(
        "movimientos_stock",
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_movimientos_stock_fecha_creacion",
        "movimientos_stock",
        ["fecha_creacion"],
    )
