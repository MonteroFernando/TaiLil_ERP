"""Permitir existencia esperada negativa en inventarios.

Revision ID: 20260817_0035
Revises: 20260817_0034
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260817_0035"
down_revision: str | None = "20260817_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE inventarios_stock_detalles "
        "DROP CONSTRAINT ck_inventarios_stock_detalles_ck_inventario_esperada_no_c0f9"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE inventarios_stock_detalles "
        "ADD CONSTRAINT ck_inventarios_stock_detalles_ck_inventario_esperada_no_c0f9 "
        "CHECK (cantidad_esperada >= 0)"
    )
