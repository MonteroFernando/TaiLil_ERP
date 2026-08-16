"""Agregar permisos de tesoreria y finanzas.

Revision ID: 20260815_0012
Revises: 20260815_0011
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0012"
down_revision: str | None = "20260815_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISOS = [
    (
        UUID("10000000-0000-0000-0000-000000000011"),
        "tesoreria.ver",
        "tesoreria",
        "ver",
        "Consultar tesoreria y cashflow",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000012"),
        "tesoreria.gestionar",
        "tesoreria",
        "gestionar",
        "Registrar operaciones de tesoreria",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000013"),
        "finanzas.ver",
        "finanzas",
        "ver",
        "Consultar informacion financiera y gastos",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000014"),
        "finanzas.gestionar",
        "finanzas",
        "gestionar",
        "Registrar operaciones financieras y gastos",
    ),
]


def upgrade() -> None:
    tabla = sa.table(
        "permisos",
        sa.column("id", sa.Uuid()),
        sa.column("codigo", sa.String()),
        sa.column("modulo", sa.String()),
        sa.column("accion", sa.String()),
        sa.column("descripcion", sa.Text()),
    )
    op.bulk_insert(
        tabla,
        [
            {"id": i, "codigo": c, "modulo": m, "accion": a, "descripcion": d}
            for i, c, m, a, d in PERMISOS
        ],
    )


def downgrade() -> None:
    ids = ", ".join(f"'{i}'" for i, *_ in PERMISOS)
    op.execute(f"DELETE FROM permisos WHERE id IN ({ids})")
