"""Hacer obligatoria la fecha y hora de los documentos POS.

Revision ID: 20260816_0031
Revises: 20260816_0030
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0031"
down_revision: str | None = "20260816_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "ventas_documentos",
        "fecha_realizacion",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
    op.alter_column(
        "cobros_documentos",
        "fecha_realizacion",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "cobros_documentos",
        "fecha_realizacion",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.alter_column(
        "ventas_documentos",
        "fecha_realizacion",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
