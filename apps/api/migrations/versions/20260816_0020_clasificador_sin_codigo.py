"""Eliminar codigo manual de clasificadores.

Revision ID: 20260816_0020
Revises: 20260816_0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0020"
down_revision: str | None = "20260816_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_clasificadores_articulos_codigo", table_name="clasificadores_articulos")
    op.drop_constraint(
        "uq_clasificadores_articulos_codigo",
        "clasificadores_articulos",
        type_="unique",
    )
    op.drop_column("clasificadores_articulos", "codigo")


def downgrade() -> None:
    op.add_column("clasificadores_articulos", sa.Column("codigo", sa.String(30), nullable=True))
    op.execute("UPDATE clasificadores_articulos SET codigo = id::text")
    op.alter_column("clasificadores_articulos", "codigo", nullable=False)
    op.create_unique_constraint(
        "uq_clasificadores_articulos_codigo", "clasificadores_articulos", ["codigo"]
    )
    op.create_index(
        "ix_clasificadores_articulos_codigo", "clasificadores_articulos", ["codigo"]
    )
