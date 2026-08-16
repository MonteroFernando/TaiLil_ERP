"""Excluir correos electronicos de la normalizacion a mayusculas.

Revision ID: 20260816_0017
Revises: 20260816_0016
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260816_0017"
down_revision: str | None = "20260816_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE socios_domicilios SET email = lower(trim(email)) WHERE email IS NOT NULL")


def downgrade() -> None:
    # No se revierte el uso de mayusculas porque el correo no distingue visualmente ese formato.
    pass
