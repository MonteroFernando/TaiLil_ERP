"""Crear listas de precios, excepciones y reglas por cantidad.

Revision ID: 20260816_0029
Revises: 20260816_0028
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0029"
down_revision: str | None = "20260816_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LISTA_COMPRAS_ID = UUID("50000000-0000-0000-0000-000000000001")
LISTA_GENERAL_ID = UUID("50000000-0000-0000-0000-000000000002")


def upgrade() -> None:
    op.create_table(
        "listas_precios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("es_base", sa.Boolean(), nullable=False),
        sa.Column("porcentaje_incremento", sa.Numeric(9, 4), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_listas_precios_nombre", "listas_precios", ["nombre"])
    op.create_table(
        "precios_articulos_base",
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("precio_bruto", sa.Numeric(18, 6), nullable=False),
        sa.Column("fecha_modificacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("articulo_id"),
    )
    op.create_table(
        "precios_articulos_listas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lista_precio_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("modo", sa.String(20), nullable=False),
        sa.Column("porcentaje_incremento", sa.Numeric(9, 4), nullable=True),
        sa.Column("precio_manual", sa.Numeric(18, 6), nullable=True),
        sa.Column("fecha_modificacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["lista_precio_id"], ["listas_precios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lista_precio_id", "articulo_id", name="uq_precio_lista_articulo"),
    )
    op.create_index(
        "ix_precios_articulos_listas_lista_precio_id",
        "precios_articulos_listas",
        ["lista_precio_id"],
    )
    op.create_index(
        "ix_precios_articulos_listas_articulo_id",
        "precios_articulos_listas",
        ["articulo_id"],
    )
    op.create_table(
        "reglas_listas_precios_articulos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("lista_precio_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_minima", sa.Numeric(18, 6), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.CheckConstraint("cantidad_minima > 0", name="ck_regla_lista_cantidad_positiva"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lista_precio_id"], ["listas_precios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("articulo_id", "lista_precio_id", name="uq_regla_articulo_lista"),
    )
    op.create_index(
        "ix_reglas_listas_precios_articulos_articulo_id",
        "reglas_listas_precios_articulos",
        ["articulo_id"],
    )
    op.create_index(
        "ix_reglas_listas_precios_articulos_lista_precio_id",
        "reglas_listas_precios_articulos",
        ["lista_precio_id"],
    )
    listas = sa.table(
        "listas_precios",
        sa.column("id", sa.Uuid()),
        sa.column("nombre", sa.String()),
        sa.column("es_base", sa.Boolean()),
        sa.column("porcentaje_incremento", sa.Numeric()),
        sa.column("activa", sa.Boolean()),
    )
    op.bulk_insert(
        listas,
        [
            {
                "id": LISTA_COMPRAS_ID,
                "nombre": "COMPRAS",
                "es_base": True,
                "porcentaje_incremento": 0,
                "activa": True,
            },
            {
                "id": LISTA_GENERAL_ID,
                "nombre": "GENERAL",
                "es_base": False,
                "porcentaje_incremento": 0,
                "activa": True,
            },
        ],
    )
    op.execute(
        "INSERT INTO precios_articulos_base (articulo_id, precio_bruto) "
        "SELECT id, 0 FROM articulos"
    )


def downgrade() -> None:
    op.drop_table("reglas_listas_precios_articulos")
    op.drop_table("precios_articulos_listas")
    op.drop_table("precios_articulos_base")
    op.drop_table("listas_precios")
