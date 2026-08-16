"""Restaurar el tipo funcional del clasificador.

Revision ID: 20260816_0022
Revises: 20260816_0021
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0022"
down_revision: str | None = "20260816_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clasificadores_articulos",
        sa.Column(
            "tipo",
            sa.String(30),
            nullable=False,
            server_default="CLASIFICACION",
        ),
    )
    op.create_index(
        "ix_clasificadores_articulos_tipo",
        "clasificadores_articulos",
        ["tipo"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_clasificadores_articulos_tipo",
        table_name="clasificadores_articulos",
    )
    op.drop_column("clasificadores_articulos", "tipo")
