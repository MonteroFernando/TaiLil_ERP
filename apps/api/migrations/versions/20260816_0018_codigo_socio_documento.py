"""Usar el documento como codigo compatible del socio.

Revision ID: 20260816_0018
Revises: 20260816_0017
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260816_0018"
down_revision: str | None = "20260816_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # La columna permanece por compatibilidad, pero deja de ser un dato solicitado.
    op.execute("UPDATE socios SET codigo = numero_documento")


def downgrade() -> None:
    # No es posible reconstruir los codigos internos anteriores.
    pass
