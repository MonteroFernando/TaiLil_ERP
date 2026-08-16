"""Separar domicilios de cliente y proveedor.

Revision ID: 20260816_0015
Revises: 20260816_0014
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0015"
down_revision: str | None = "20260816_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "socios_domicilios",
        sa.Column("rol", sa.String(20), nullable=False, server_default="proveedor"),
    )
    # Dato identificado por el usuario como cargado desde la ficha de cliente.
    op.execute(
        "UPDATE socios_domicilios SET rol = 'cliente' "
        "WHERE calle = 'JUAN JOSE CASTELLI' AND numero = '2174'"
    )
    op.create_index("ix_socios_domicilios_rol", "socios_domicilios", ["rol"])
    op.create_check_constraint(
        "ck_domicilio_rol_valido",
        "socios_domicilios",
        "rol IN ('cliente', 'proveedor')",
    )
    op.alter_column("socios_domicilios", "rol", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_domicilio_rol_valido", "socios_domicilios", type_="check")
    op.drop_index("ix_socios_domicilios_rol", table_name="socios_domicilios")
    op.drop_column("socios_domicilios", "rol")
