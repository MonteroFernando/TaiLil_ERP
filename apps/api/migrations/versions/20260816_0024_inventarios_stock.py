"""Crear inventarios fisicos y sus lineas de conteo.

Revision ID: 20260816_0024
Revises: 20260816_0023
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0024"
down_revision: str | None = "20260816_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.schema.CreateSequence(sa.Sequence("secuencia_inventarios_stock", start=1)))
    op.create_table(
        "inventarios_stock",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("observacion", sa.Text(), nullable=True),
        sa.Column("usuario_creacion_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_finalizacion_id", sa.Uuid(), nullable=True),
        sa.Column("movimiento_ajuste_id", sa.Uuid(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_finalizacion", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_creacion_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_finalizacion_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["movimiento_ajuste_id"], ["movimientos_stock.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("movimiento_ajuste_id"),
    )
    for columna in ("numero", "almacen_id", "estado", "fecha_creacion"):
        op.create_index(f"ix_inventarios_stock_{columna}", "inventarios_stock", [columna])
    op.create_table(
        "inventarios_stock_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inventario_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_esperada", sa.Numeric(18, 6), nullable=False),
        sa.Column("cantidad_contada", sa.Numeric(18, 6), nullable=True),
        sa.Column("observacion", sa.Text(), nullable=True),
        sa.CheckConstraint("cantidad_esperada >= 0", name="ck_inventario_esperada_no_negativa"),
        sa.CheckConstraint(
            "cantidad_contada IS NULL OR cantidad_contada >= 0",
            name="ck_inventario_contada_no_negativa",
        ),
        sa.ForeignKeyConstraint(["inventario_id"], ["inventarios_stock.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("inventario_id", "articulo_id", name="uq_inventario_articulo"),
    )
    op.create_index(
        "ix_inventarios_stock_detalles_inventario_id",
        "inventarios_stock_detalles",
        ["inventario_id"],
    )
    op.create_index(
        "ix_inventarios_stock_detalles_articulo_id",
        "inventarios_stock_detalles",
        ["articulo_id"],
    )


def downgrade() -> None:
    op.drop_table("inventarios_stock_detalles")
    op.drop_table("inventarios_stock")
    op.execute(sa.schema.DropSequence(sa.Sequence("secuencia_inventarios_stock")))
