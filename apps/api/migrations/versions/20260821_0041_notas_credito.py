"""Agregar notas de credito para clientes y proveedores.

Revision ID: 20260821_0041
Revises: 20260821_0040
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260821_0041"
down_revision: str | None = "20260821_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE secuencia_notas_credito START 1")
    op.create_table(
        "notas_credito",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("socio_id", sa.Uuid(), nullable=False),
        sa.Column("venta_id", sa.Uuid(), nullable=True),
        sa.Column("factura_compra_id", sa.Uuid(), nullable=True),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("numero_externo", sa.String(80), nullable=True),
        sa.Column("motivo", sa.String(250), nullable=False),
        sa.Column("afecta_stock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="CONFIRMADO"),
        sa.Column("movimiento_stock_id", sa.Uuid(), nullable=True),
        sa.Column("cobro_id", sa.Uuid(), nullable=True),
        sa.Column("pago_id", sa.Uuid(), nullable=True),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("fecha_realizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("tipo IN ('CLIENTE', 'PROVEEDOR')", name="nota_credito_tipo_valido"),
        sa.CheckConstraint("total_bruto > 0", name="nota_credito_total_positivo"),
        sa.CheckConstraint(
            "(tipo = 'CLIENTE' AND venta_id IS NOT NULL AND factura_compra_id IS NULL AND cobro_id IS NOT NULL AND pago_id IS NULL) OR "
            "(tipo = 'PROVEEDOR' AND factura_compra_id IS NOT NULL AND venta_id IS NULL AND pago_id IS NOT NULL AND cobro_id IS NULL)",
            name="nota_credito_origen_valido",
        ),
        sa.ForeignKeyConstraint(["socio_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["factura_compra_id"], ["facturas_compra.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["movimiento_stock_id"], ["movimientos_stock.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cobro_id"], ["cobros_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pago_id"], ["pagos_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("movimiento_stock_id"),
        sa.UniqueConstraint("cobro_id"),
        sa.UniqueConstraint("pago_id"),
    )
    for columna in ("numero", "tipo", "socio_id", "venta_id", "factura_compra_id", "numero_externo", "estado", "fecha_realizacion"):
        op.create_index(f"ix_notas_credito_{columna}", "notas_credito", [columna])
    op.create_table(
        "notas_credito_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nota_credito_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("venta_detalle_id", sa.Uuid(), nullable=True),
        sa.Column("factura_detalle_id", sa.Uuid(), nullable=True),
        sa.Column("cantidad_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("importe_unitario_bruto", sa.Numeric(18, 6), nullable=False),
        sa.Column("porcentaje_iva", sa.Numeric(9, 4), nullable=False, server_default="0"),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False),
        sa.CheckConstraint("cantidad_base > 0", name="nota_credito_cantidad_positiva"),
        sa.CheckConstraint("total_bruto > 0", name="nota_credito_detalle_total_positivo"),
        sa.CheckConstraint(
            "(venta_detalle_id IS NOT NULL AND factura_detalle_id IS NULL) OR "
            "(factura_detalle_id IS NOT NULL AND venta_detalle_id IS NULL)",
            name="nota_credito_detalle_origen_valido",
        ),
        sa.ForeignKeyConstraint(["nota_credito_id"], ["notas_credito.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venta_detalle_id"], ["ventas_documentos_detalles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["factura_detalle_id"], ["facturas_compra_detalles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for columna in ("nota_credito_id", "venta_detalle_id", "factura_detalle_id"):
        op.create_index(f"ix_notas_credito_detalles_{columna}", "notas_credito_detalles", [columna])


def downgrade() -> None:
    op.drop_table("notas_credito_detalles")
    op.drop_table("notas_credito")
    op.execute("DROP SEQUENCE secuencia_notas_credito")
