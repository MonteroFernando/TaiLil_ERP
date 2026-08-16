"""Renombrar la seleccion como unidad alternativa.

Revision ID: 20260815_0006
Revises: 20260815_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0006"
down_revision: str | None = "20260815_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(
        "uq_articulos_unidades_predeterminada_ingreso",
        table_name="articulos_unidades",
    )
    op.alter_column(
        "articulos_unidades",
        "es_predeterminada_ingreso",
        new_column_name="es_unidad_alternativa",
    )
    # La unidad base es la normal; una alternativa se elige explicitamente.
    op.execute("UPDATE articulos_unidades SET es_unidad_alternativa = false")
    op.create_index(
        "uq_articulos_unidades_alternativa",
        "articulos_unidades",
        ["articulo_id"],
        unique=True,
        postgresql_where=sa.text("es_unidad_alternativa = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_articulos_unidades_alternativa",
        table_name="articulos_unidades",
    )
    op.alter_column(
        "articulos_unidades",
        "es_unidad_alternativa",
        new_column_name="es_predeterminada_ingreso",
    )
    op.execute("UPDATE articulos_unidades SET es_predeterminada_ingreso = es_unidad_base")
    op.create_index(
        "uq_articulos_unidades_predeterminada_ingreso",
        "articulos_unidades",
        ["articulo_id"],
        unique=True,
        postgresql_where=sa.text("es_predeterminada_ingreso = true"),
    )
