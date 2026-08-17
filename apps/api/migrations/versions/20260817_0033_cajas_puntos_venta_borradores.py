"""Configurar puntos de venta, cajas, aperturas y borradores.

Revision ID: 20260817_0033
Revises: 20260816_0032
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260817_0033"
down_revision: str | None = "20260816_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "puntos_venta",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(4), nullable=False),
        sa.Column("descripcion", sa.String(120), nullable=False),
        sa.Column("letra", sa.String(1), server_default="T", nullable=False),
        sa.Column("tipo_documento", sa.String(30), server_default="PRESUPUESTO", nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("ultimo_numero", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.ForeignKeyConstraint(["almacen_id"], ["almacenes.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
    )
    op.create_index("ix_puntos_venta_codigo", "puntos_venta", ["codigo"])
    op.create_table(
        "cajas_ventas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("punto_venta_id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("descripcion", sa.String(120), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.ForeignKeyConstraint(["punto_venta_id"], ["puntos_venta.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("punto_venta_id", "codigo", name="uq_caja_punto_codigo"),
    )
    op.create_index("ix_cajas_ventas_punto_venta_id", "cajas_ventas", ["punto_venta_id"])
    op.create_table(
        "aperturas_cajas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("caja_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("efectivo_inicial", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "fecha_apertura",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("fecha_cierre", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["caja_id"], ["cajas_ventas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_aperturas_cajas_caja_id", "aperturas_cajas", ["caja_id"])
    op.create_index("ix_aperturas_cajas_usuario_id", "aperturas_cajas", ["usuario_id"])
    op.create_index("ix_aperturas_cajas_estado", "aperturas_cajas", ["estado"])
    op.create_index("ix_aperturas_cajas_fecha_apertura", "aperturas_cajas", ["fecha_apertura"])
    op.create_index(
        "uq_apertura_caja_abierta",
        "aperturas_cajas",
        ["caja_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ABIERTA'"),
    )
    op.create_index(
        "uq_apertura_usuario_abierta",
        "aperturas_cajas",
        ["usuario_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ABIERTA'"),
    )
    op.execute(
        """
        INSERT INTO puntos_venta
            (id, codigo, descripcion, letra, tipo_documento, almacen_id, ultimo_numero, activo)
        SELECT '00000000-0000-0000-0000-000000000101', '0001', 'PUNTO DE VENTA 0001',
               'T', 'PRESUPUESTO', id, 0, true
        FROM almacenes WHERE es_predeterminado = true LIMIT 1
        """
    )
    op.execute(
        """
        INSERT INTO cajas_ventas (id, punto_venta_id, codigo, descripcion, activo)
        SELECT '00000000-0000-0000-0000-000000000201', id, 'CAJA01', 'CAJA 01', true
        FROM puntos_venta WHERE codigo = '0001'
        """
    )
    op.add_column("ventas_documentos", sa.Column("punto_venta_id", sa.Uuid(), nullable=True))
    op.add_column("ventas_documentos", sa.Column("caja_id", sa.Uuid(), nullable=True))
    op.add_column("ventas_documentos", sa.Column("apertura_caja_id", sa.Uuid(), nullable=True))
    op.add_column(
        "ventas_documentos", sa.Column("letra", sa.String(1), server_default="T", nullable=False)
    )
    op.add_column(
        "ventas_documentos",
        sa.Column("tipo_documento", sa.String(30), server_default="PRESUPUESTO", nullable=False),
    )
    op.add_column(
        "ventas_documentos",
        sa.Column(
            "fecha_modificacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.alter_column("ventas_documentos", "numero", existing_type=sa.BigInteger(), nullable=True)
    op.drop_constraint("uq_ventas_documentos_numero", "ventas_documentos", type_="unique")
    for columna, tabla in (
        ("punto_venta_id", "puntos_venta"),
        ("caja_id", "cajas_ventas"),
        ("apertura_caja_id", "aperturas_cajas"),
    ):
        op.create_foreign_key(
            f"fk_ventas_documentos_{columna}_{tabla}",
            "ventas_documentos",
            tabla,
            [columna],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_index(f"ix_ventas_documentos_{columna}", "ventas_documentos", [columna])
    op.execute(
        """
        UPDATE ventas_documentos
        SET punto_venta_id = '00000000-0000-0000-0000-000000000101', letra = 'T',
            tipo_documento = 'PRESUPUESTO'
        WHERE punto_venta_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE puntos_venta SET ultimo_numero = COALESCE(
            (SELECT MAX(numero) FROM ventas_documentos WHERE punto_venta_id = puntos_venta.id), 0
        )
        """
    )
    op.create_unique_constraint(
        "uq_venta_punto_letra_numero",
        "ventas_documentos",
        ["punto_venta_id", "letra", "numero"],
    )
    op.add_column(
        "ventas_documentos_detalles",
        sa.Column("precio_anterior_bruto", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "ventas_documentos_detalles",
        sa.Column("descuento_porcentual", sa.Numeric(9, 4), server_default="0", nullable=False),
    )
    op.create_table(
        "reimpresiones_ventas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venta_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("formato", sa.String(10), nullable=False),
        sa.Column(
            "fecha", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reimpresiones_ventas_venta_id", "reimpresiones_ventas", ["venta_id"])


def downgrade() -> None:
    op.drop_table("reimpresiones_ventas")
    op.drop_column("ventas_documentos_detalles", "descuento_porcentual")
    op.drop_column("ventas_documentos_detalles", "precio_anterior_bruto")
    op.drop_constraint("uq_venta_punto_letra_numero", "ventas_documentos", type_="unique")
    for columna, tabla in (
        ("apertura_caja_id", "aperturas_cajas"),
        ("caja_id", "cajas_ventas"),
        ("punto_venta_id", "puntos_venta"),
    ):
        op.drop_index(f"ix_ventas_documentos_{columna}", table_name="ventas_documentos")
        op.drop_constraint(
            f"fk_ventas_documentos_{columna}_{tabla}", "ventas_documentos", type_="foreignkey"
        )
        op.drop_column("ventas_documentos", columna)
    op.drop_column("ventas_documentos", "fecha_modificacion")
    op.drop_column("ventas_documentos", "tipo_documento")
    op.drop_column("ventas_documentos", "letra")
    op.alter_column("ventas_documentos", "numero", existing_type=sa.BigInteger(), nullable=False)
    op.create_unique_constraint("uq_ventas_documentos_numero", "ventas_documentos", ["numero"])
    op.drop_table("aperturas_cajas")
    op.drop_table("cajas_ventas")
    op.drop_table("puntos_venta")
