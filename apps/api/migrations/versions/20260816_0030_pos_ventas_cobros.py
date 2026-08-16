"""Crear documentos internos de venta, cobro e imputacion POS.

Revision ID: 20260816_0030
Revises: 20260816_0029
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260816_0030"
down_revision: str | None = "20260816_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.schema.CreateSequence(sa.Sequence("secuencia_ventas", start=1)))
    op.execute(sa.schema.CreateSequence(sa.Sequence("secuencia_cobros", start=1)))
    op.create_table(
        "ventas_documentos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("cliente_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("subtotal_neto", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_iva", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(18, 2), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("movimiento_stock_id", sa.Uuid(), nullable=True),
        sa.Column("fecha_realizacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["cliente_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["movimiento_stock_id"], ["movimientos_stock.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        sa.UniqueConstraint("movimiento_stock_id"),
    )
    for columna in ("numero", "cliente_id", "estado", "fecha_realizacion"):
        op.create_index(f"ix_ventas_documentos_{columna}", "ventas_documentos", [columna])
    op.create_table(
        "ventas_documentos_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venta_id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("lista_precio_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("precio_unitario_bruto", sa.Numeric(18, 6), nullable=False),
        sa.Column("porcentaje_iva", sa.Numeric(9, 4), nullable=False),
        sa.Column("subtotal_neto", sa.Numeric(18, 2), nullable=False),
        sa.Column("importe_iva", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_bruto", sa.Numeric(18, 2), nullable=False),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lista_precio_id"], ["listas_precios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ventas_documentos_detalles_venta_id", "ventas_documentos_detalles", ["venta_id"]
    )
    op.create_table(
        "cobros_documentos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("cliente_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("total", sa.Numeric(18, 2), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("fecha_realizacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["cliente_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
    )
    for columna in ("numero", "cliente_id", "estado", "fecha_realizacion"):
        op.create_index(f"ix_cobros_documentos_{columna}", "cobros_documentos", [columna])
    op.create_table(
        "cobros_medios_pago",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cobro_id", sa.Uuid(), nullable=False),
        sa.Column("medio", sa.String(30), nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), nullable=False),
        sa.Column("referencia", sa.String(120), nullable=True),
        sa.ForeignKeyConstraint(["cobro_id"], ["cobros_documentos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cobros_medios_pago_cobro_id", "cobros_medios_pago", ["cobro_id"])
    op.create_table(
        "imputaciones_cobros_ventas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cobro_id", sa.Uuid(), nullable=False),
        sa.Column("venta_id", sa.Uuid(), nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), nullable=False),
        sa.ForeignKeyConstraint(["cobro_id"], ["cobros_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas_documentos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cobro_id", "venta_id", name="uq_imputacion_cobro_venta"),
    )
    op.create_index(
        "ix_imputaciones_cobros_ventas_cobro_id", "imputaciones_cobros_ventas", ["cobro_id"]
    )
    op.create_index(
        "ix_imputaciones_cobros_ventas_venta_id", "imputaciones_cobros_ventas", ["venta_id"]
    )


def downgrade() -> None:
    op.drop_table("imputaciones_cobros_ventas")
    op.drop_table("cobros_medios_pago")
    op.drop_table("cobros_documentos")
    op.drop_table("ventas_documentos_detalles")
    op.drop_table("ventas_documentos")
    op.execute(sa.schema.DropSequence(sa.Sequence("secuencia_cobros")))
    op.execute(sa.schema.DropSequence(sa.Sequence("secuencia_ventas")))
