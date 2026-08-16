"""Crear historial transaccional de movimientos de stock.

Revision ID: 20260816_0023
Revises: 20260816_0022
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0023"
down_revision: str | None = "20260816_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.schema.CreateSequence(sa.Sequence("secuencia_movimientos_stock", start=1)))
    op.create_table(
        "movimientos_stock",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("almacen_origen_id", sa.Uuid(), nullable=True),
        sa.Column("almacen_destino_id", sa.Uuid(), nullable=True),
        sa.Column("documento_tipo", sa.String(40), nullable=True),
        sa.Column("documento_numero", sa.String(80), nullable=True),
        sa.Column("observacion", sa.Text(), nullable=True),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("movimiento_revertido_id", sa.Uuid(), nullable=True),
        sa.Column("fecha_confirmacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["almacen_origen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_destino_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["movimiento_revertido_id"], ["movimientos_stock.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("movimiento_revertido_id"),
    )
    for columna in (
        "numero",
        "tipo",
        "estado",
        "almacen_origen_id",
        "almacen_destino_id",
        "fecha_confirmacion",
    ):
        op.create_index(f"ix_movimientos_stock_{columna}", "movimientos_stock", [columna])
    op.create_table(
        "movimientos_stock_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("movimiento_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("unidad_medida_id", sa.Uuid(), nullable=False),
        sa.Column("factor_conversion", sa.Numeric(18, 6), nullable=False),
        sa.Column("saldo_anterior", sa.Numeric(18, 6), nullable=False),
        sa.Column("saldo_posterior", sa.Numeric(18, 6), nullable=False),
        sa.CheckConstraint("cantidad_base <> 0", name="ck_movimiento_cantidad_no_cero"),
        sa.ForeignKeyConstraint(["movimiento_id"], ["movimientos_stock.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["unidad_medida_id"], ["unidades_medida.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for columna in ("movimiento_id", "articulo_id", "almacen_id"):
        op.create_index(
            f"ix_movimientos_stock_detalles_{columna}",
            "movimientos_stock_detalles",
            [columna],
        )


def downgrade() -> None:
    op.drop_table("movimientos_stock_detalles")
    op.drop_table("movimientos_stock")
    op.execute(sa.schema.DropSequence(sa.Sequence("secuencia_movimientos_stock")))
