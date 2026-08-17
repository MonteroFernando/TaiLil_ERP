"""Ingresos de mercaderia y facturas de compra.

Revision ID: 20260817_0036
Revises: 20260817_0035
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260817_0036"
down_revision: str | None = "20260817_0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE secuencia_ingresos_mercaderia START 1")
    op.execute("CREATE SEQUENCE secuencia_facturas_compra START 1")
    op.create_table(
        "ingresos_mercaderia",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("proveedor_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="CONFIRMADO"),
        sa.Column("observacion", sa.Text()),
        sa.Column("movimiento_stock_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_realizacion",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["proveedor_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["movimiento_stock_id"], ["movimientos_stock.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("movimiento_stock_id"),
    )
    op.create_table(
        "ingresos_mercaderia_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ingreso_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("stock_anterior", sa.Numeric(18, 6), nullable=False),
        sa.ForeignKeyConstraint(["ingreso_id"], ["ingresos_mercaderia.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ingreso_id", "articulo_id", name="uq_ingreso_articulo"),
    )
    op.create_table(
        "facturas_compra",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("numero_proveedor", sa.String(80), nullable=False),
        sa.Column("proveedor_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("ingreso_id", sa.Uuid()),
        sa.Column("politica_costo", sa.String(20), nullable=False),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="CONFIRMADO"),
        sa.Column("movimiento_stock_id", sa.Uuid()),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_realizacion",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["proveedor_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["ingreso_id"], ["ingresos_mercaderia.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["movimiento_stock_id"], ["movimientos_stock.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("ingreso_id"),
        sa.UniqueConstraint("movimiento_stock_id"),
    )
    op.create_table(
        "facturas_compra_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("factura_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("ingreso_detalle_id", sa.Uuid()),
        sa.Column("cantidad_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("costo_bruto_unitario", sa.Numeric(18, 6), nullable=False),
        sa.Column("costo_anterior", sa.Numeric(18, 6), nullable=False),
        sa.Column("costo_resultante", sa.Numeric(18, 6), nullable=False),
        sa.Column("stock_anterior", sa.Numeric(18, 6), nullable=False),
        sa.Column("politica_costo", sa.String(20), nullable=False),
        sa.Column("advertencia", sa.String(250)),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False),
        sa.ForeignKeyConstraint(["factura_id"], ["facturas_compra.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["ingreso_detalle_id"], ["ingresos_mercaderia_detalles.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("facturas_compra_detalles")
    op.drop_table("facturas_compra")
    op.drop_table("ingresos_mercaderia_detalles")
    op.drop_table("ingresos_mercaderia")
    op.execute("DROP SEQUENCE secuencia_facturas_compra")
    op.execute("DROP SEQUENCE secuencia_ingresos_mercaderia")
