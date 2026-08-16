"""Agregar clasificadores, almacenes y stock por articulo.

Revision ID: 20260816_0013
Revises: 20260815_0012
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0013"
down_revision: str | None = "20260815_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALMACEN_DEFAULT_ID = UUID("40000000-0000-0000-0000-000000000001")


def upgrade() -> None:
    op.create_table(
        "clasificadores_articulos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("padre_id", sa.Uuid(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["padre_id"],
            ["clasificadores_articulos.id"],
            name="fk_clasificador_padre",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_clasificadores_articulos"),
        sa.UniqueConstraint("codigo", name="uq_clasificadores_articulos_codigo"),
    )
    op.create_index("ix_clasificadores_articulos_codigo", "clasificadores_articulos", ["codigo"])
    op.create_index("ix_clasificadores_articulos_nombre", "clasificadores_articulos", ["nombre"])
    op.create_index(
        "ix_clasificadores_articulos_padre_id", "clasificadores_articulos", ["padre_id"]
    )
    op.create_table(
        "articulos_clasificadores",
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("clasificador_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["articulo_id"],
            ["articulos.id"],
            name="fk_articulo_clasificacion_articulo",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["clasificador_id"],
            ["clasificadores_articulos.id"],
            name="fk_articulo_clasificacion_clasificador",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "articulo_id", "clasificador_id", name="pk_articulos_clasificadores"
        ),
    )
    op.create_table(
        "almacenes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("descripcion", sa.String(150), nullable=False),
        sa.Column("ubicacion", sa.String(250), nullable=True),
        sa.Column("es_predeterminado", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_almacenes"),
        sa.UniqueConstraint("codigo", name="uq_almacenes_codigo"),
    )
    op.create_index("ix_almacenes_codigo", "almacenes", ["codigo"])
    op.create_index(
        "uq_almacenes_predeterminado",
        "almacenes",
        ["es_predeterminado"],
        unique=True,
        postgresql_where=sa.text("es_predeterminado = true"),
    )
    op.execute(
        sa.text(
            "INSERT INTO almacenes "
            "(id,codigo,descripcion,ubicacion,es_predeterminado,activo) "
            "VALUES (:id,'ALM001','ALMACEN PRINCIPAL',NULL,true,true)"
        ).bindparams(id=ALMACEN_DEFAULT_ID)
    )
    op.create_table(
        "stocks_articulos_almacenes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_fisica", sa.Numeric(18, 6), nullable=False),
        sa.Column("cantidad_pedida", sa.Numeric(18, 6), nullable=False),
        sa.Column("cantidad_reservada", sa.Numeric(18, 6), nullable=False),
        sa.CheckConstraint(
            "cantidad_fisica >= 0", name="ck_stock_fisico_no_negativo"
        ),
        sa.CheckConstraint(
            "cantidad_pedida >= 0", name="ck_stock_pedido_no_negativo"
        ),
        sa.CheckConstraint(
            "cantidad_reservada >= 0",
            name="ck_stock_reservado_no_negativo",
        ),
        sa.ForeignKeyConstraint(
            ["articulo_id"],
            ["articulos.id"],
            name="fk_stock_articulo",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["almacen_id"],
            ["almacenes.id"],
            name="fk_stock_almacen",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_stocks_articulos_almacenes"),
        sa.UniqueConstraint("articulo_id", "almacen_id", name="uq_stock_articulo_almacen"),
    )
    op.create_index(
        "ix_stocks_articulos_almacenes_articulo_id", "stocks_articulos_almacenes", ["articulo_id"]
    )
    op.create_index(
        "ix_stocks_articulos_almacenes_almacen_id", "stocks_articulos_almacenes", ["almacen_id"]
    )
    op.execute(
        sa.text(
            "INSERT INTO stocks_articulos_almacenes "
            "(id,articulo_id,almacen_id,cantidad_fisica,cantidad_pedida,cantidad_reservada) "
            "SELECT gen_random_uuid(),id,:almacen,0,0,0 FROM articulos"
        ).bindparams(almacen=ALMACEN_DEFAULT_ID)
    )


def downgrade() -> None:
    op.drop_table("stocks_articulos_almacenes")
    op.drop_table("almacenes")
    op.drop_table("articulos_clasificadores")
    op.drop_table("clasificadores_articulos")
