"""Eliminar tipo redundante de clasificadores.

Revision ID: 20260816_0021
Revises: 20260816_0020
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0021"
down_revision: str | None = "20260816_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("clasificadores_articulos", "tipo")


def downgrade() -> None:
    op.add_column(
        "clasificadores_articulos",
        sa.Column("tipo", sa.String(30), nullable=False, server_default="categoria"),
    )
