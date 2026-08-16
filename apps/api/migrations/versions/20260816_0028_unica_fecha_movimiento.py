"""Conservar solamente la fecha de impacto del movimiento.

Revision ID: 20260816_0028
Revises: 20260816_0027
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0028"
down_revision: str | None = "20260816_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(
        "ix_movimientos_stock_fecha_modificacion", table_name="movimientos_stock"
    )
    op.drop_column("movimientos_stock", "fecha_modificacion")


def downgrade() -> None:
    op.add_column(
        "movimientos_stock",
        sa.Column(
            "fecha_modificacion",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_movimientos_stock_fecha_modificacion",
        "movimientos_stock",
        ["fecha_modificacion"],
    )
