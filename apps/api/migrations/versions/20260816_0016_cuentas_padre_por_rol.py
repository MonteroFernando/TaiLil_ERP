"""Separar cuentas padre de cliente y proveedor.

Revision ID: 20260816_0016
Revises: 20260816_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0016"
down_revision: str | None = "20260816_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columnas = {columna["name"] for columna in inspector.get_columns("socios")}
    if "cuenta_padre_cliente_id" not in columnas:
        op.add_column("socios", sa.Column("cuenta_padre_cliente_id", sa.Uuid(), nullable=True))
    if "cuenta_padre_proveedor_id" not in columnas:
        op.add_column("socios", sa.Column("cuenta_padre_proveedor_id", sa.Uuid(), nullable=True))
    inspector = sa.inspect(op.get_bind())
    foraneas = {foranea["name"] for foranea in inspector.get_foreign_keys("socios")}
    if "fk_socio_padre_cliente" not in foraneas:
        op.create_foreign_key(
            "fk_socio_padre_cliente",
            "socios",
            "socios",
            ["cuenta_padre_cliente_id"],
            ["id"],
            ondelete="RESTRICT",
        )
    if "fk_socio_padre_proveedor" not in foraneas:
        op.create_foreign_key(
            "fk_socio_padre_proveedor",
            "socios",
            "socios",
            ["cuenta_padre_proveedor_id"],
            ["id"],
            ondelete="RESTRICT",
        )
    indices = {indice["name"] for indice in inspector.get_indexes("socios")}
    if "ix_socios_padre_cliente" not in indices:
        op.create_index("ix_socios_padre_cliente", "socios", ["cuenta_padre_cliente_id"])
    if "ix_socios_padre_proveedor" not in indices:
        op.create_index("ix_socios_padre_proveedor", "socios", ["cuenta_padre_proveedor_id"])
    op.execute(
        "UPDATE socios SET cuenta_padre_cliente_id = cuenta_padre_id WHERE es_cliente = true"
    )
    op.execute(
        "UPDATE socios SET cuenta_padre_proveedor_id = cuenta_padre_id WHERE es_proveedor = true"
    )


def downgrade() -> None:
    op.drop_index("ix_socios_padre_proveedor", table_name="socios")
    op.drop_index("ix_socios_padre_cliente", table_name="socios")
    op.drop_constraint("fk_socio_padre_proveedor", "socios", type_="foreignkey")
    op.drop_constraint("fk_socio_padre_cliente", "socios", type_="foreignkey")
    op.drop_column("socios", "cuenta_padre_proveedor_id")
    op.drop_column("socios", "cuenta_padre_cliente_id")
