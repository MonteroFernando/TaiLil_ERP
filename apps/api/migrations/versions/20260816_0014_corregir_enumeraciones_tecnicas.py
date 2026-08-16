"""Corregir enumeraciones tecnicas normalizadas como texto de negocio.

Revision ID: 20260816_0014
Revises: 20260816_0013
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260816_0014"
down_revision: str | None = "20260816_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Son codigos internos de la API, no textos visibles de negocio.
    op.execute("UPDATE socios SET tipo_persona = lower(tipo_persona)")
    op.execute("UPDATE socios_domicilios SET tipo = lower(tipo)")


def downgrade() -> None:
    op.execute("UPDATE socios SET tipo_persona = upper(tipo_persona)")
    op.execute("UPDATE socios_domicilios SET tipo = upper(tipo)")
