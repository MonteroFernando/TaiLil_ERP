"""Agregar notas narrativas y devoluciones de caja.

Revision ID: 20260822_0043
Revises: 20260822_0042
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0043"
down_revision: str | None = "20260822_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "notas_credito",
        sa.Column("modalidad", sa.String(20), nullable=False, server_default="PRODUCTOS"),
    )
    op.add_column("notas_credito", sa.Column("devolucion_cobro_id", sa.Uuid(), nullable=True))
    op.add_column("notas_credito", sa.Column("movimiento_caja_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_notas_credito_devolucion_cobro",
        "notas_credito",
        "cobros_documentos",
        ["devolucion_cobro_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_notas_credito_movimiento_caja",
        "notas_credito",
        "movimientos_caja",
        ["movimiento_caja_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_notas_credito_devolucion_cobro_id", "notas_credito", ["devolucion_cobro_id"]
    )
    op.create_unique_constraint(
        "uq_notas_credito_movimiento_caja_id", "notas_credito", ["movimiento_caja_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_notas_credito_movimiento_caja_id", "notas_credito", type_="unique")
    op.drop_constraint("uq_notas_credito_devolucion_cobro_id", "notas_credito", type_="unique")
    op.drop_constraint("fk_notas_credito_movimiento_caja", "notas_credito", type_="foreignkey")
    op.drop_constraint("fk_notas_credito_devolucion_cobro", "notas_credito", type_="foreignkey")
    op.drop_column("notas_credito", "movimiento_caja_id")
    op.drop_column("notas_credito", "devolucion_cobro_id")
    op.drop_column("notas_credito", "modalidad")
