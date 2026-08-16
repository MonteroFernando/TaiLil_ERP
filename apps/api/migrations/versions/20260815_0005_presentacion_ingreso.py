"""Agregar presentacion predeterminada de ingreso.

Revision ID: 20260815_0005
Revises: 20260815_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0005"
down_revision: str | None = "20260815_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "articulos_unidades",
        sa.Column(
            "es_predeterminada_ingreso",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            "UPDATE articulos_unidades SET es_predeterminada_ingreso = true "
            "WHERE es_unidad_base = true"
        )
    )
    op.create_index(
        "uq_articulos_unidades_predeterminada_ingreso",
        "articulos_unidades",
        ["articulo_id"],
        unique=True,
        postgresql_where=sa.text("es_predeterminada_ingreso = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_articulos_unidades_predeterminada_ingreso",
        table_name="articulos_unidades",
    )
    op.drop_column("articulos_unidades", "es_predeterminada_ingreso")
