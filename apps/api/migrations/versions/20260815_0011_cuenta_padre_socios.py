"""Agregar cuenta padre a socios comerciales.

Revision ID: 20260815_0011
Revises: 20260815_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0011"
down_revision: str | None = "20260815_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("socios", sa.Column("cuenta_padre_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_socios_cuenta_padre_id_socios",
        "socios",
        "socios",
        ["cuenta_padre_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_socios_cuenta_padre_id", "socios", ["cuenta_padre_id"])


def downgrade() -> None:
    op.drop_index("ix_socios_cuenta_padre_id", table_name="socios")
    op.drop_constraint("fk_socios_cuenta_padre_id_socios", "socios", type_="foreignkey")
    op.drop_column("socios", "cuenta_padre_id")
