"""Permitir stock fisico negativo.

Revision ID: 20260817_0034
Revises: 20260817_0033
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260817_0034"
down_revision: str | None = "20260817_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # El stock fisico puede quedar negativo: representa una diferencia operativa
    # que debe permanecer visible y corregirse mediante documentos posteriores.
    # Se usa el nombre fisico porque la convencion historica agrego dos veces
    # el prefijo `ck_` al crear esta restriccion.
    op.execute(
        "ALTER TABLE stocks_articulos_almacenes "
        "DROP CONSTRAINT ck_stocks_articulos_almacenes_ck_stock_fisico_no_negativo"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE stocks_articulos_almacenes "
        "ADD CONSTRAINT ck_stocks_articulos_almacenes_ck_stock_fisico_no_negativo "
        "CHECK (cantidad_fisica >= 0)"
    )
