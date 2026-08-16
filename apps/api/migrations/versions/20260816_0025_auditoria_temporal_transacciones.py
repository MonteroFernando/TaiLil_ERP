"""Agregar fecha de modificacion a cabeceras transaccionales.

Revision ID: 20260816_0025
Revises: 20260816_0024
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0025"
down_revision: str | None = "20260816_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "movimientos_stock",
        sa.Column("fecha_modificacion", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE movimientos_stock SET fecha_modificacion = fecha_confirmacion")
    op.alter_column(
        "movimientos_stock",
        "fecha_modificacion",
        nullable=False,
        server_default=sa.func.now(),
    )
    op.create_index(
        "ix_movimientos_stock_fecha_modificacion",
        "movimientos_stock",
        ["fecha_modificacion"],
    )
    op.add_column(
        "inventarios_stock",
        sa.Column("fecha_modificacion", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE inventarios_stock "
        "SET fecha_modificacion = COALESCE(fecha_finalizacion, fecha_creacion)"
    )
    op.alter_column(
        "inventarios_stock",
        "fecha_modificacion",
        nullable=False,
        server_default=sa.func.now(),
    )
    op.create_index(
        "ix_inventarios_stock_fecha_modificacion",
        "inventarios_stock",
        ["fecha_modificacion"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inventarios_stock_fecha_modificacion", table_name="inventarios_stock"
    )
    op.drop_column("inventarios_stock", "fecha_modificacion")
    op.drop_index(
        "ix_movimientos_stock_fecha_modificacion", table_name="movimientos_stock"
    )
    op.drop_column("movimientos_stock", "fecha_modificacion")
