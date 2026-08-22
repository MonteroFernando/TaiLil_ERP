"""Clasificar gastos directos y relacionarlos opcionalmente con proveedores.

Revision ID: 20260822_0047
Revises: 20260822_0046
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0047"
down_revision: str | None = "20260822_0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "movimientos_caja",
        sa.Column(
            "categoria",
            sa.String(30),
            nullable=False,
            server_default="MOVIMIENTO_MANUAL",
        ),
    )
    op.add_column(
        "movimientos_caja",
        sa.Column("proveedor_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "movimientos_caja",
        sa.Column("referencia", sa.String(120), nullable=True),
    )
    op.create_foreign_key(
        "fk_movimientos_caja_proveedor_id_socios",
        "movimientos_caja",
        "socios",
        ["proveedor_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_movimientos_caja_categoria", "movimientos_caja", ["categoria"])
    op.create_index("ix_movimientos_caja_proveedor_id", "movimientos_caja", ["proveedor_id"])


def downgrade() -> None:
    op.drop_index("ix_movimientos_caja_proveedor_id", table_name="movimientos_caja")
    op.drop_index("ix_movimientos_caja_categoria", table_name="movimientos_caja")
    op.drop_constraint(
        "fk_movimientos_caja_proveedor_id_socios",
        "movimientos_caja",
        type_="foreignkey",
    )
    op.drop_column("movimientos_caja", "referencia")
    op.drop_column("movimientos_caja", "proveedor_id")
    op.drop_column("movimientos_caja", "categoria")
