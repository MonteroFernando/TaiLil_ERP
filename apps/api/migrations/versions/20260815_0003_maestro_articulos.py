"""Crear maestro de articulos.

Revision ID: 20260815_0003
Revises: 20260815_0002
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0003"
down_revision: str | None = "20260815_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UNIDADES = [
    (UUID("20000000-0000-0000-0000-000000000001"), "UN", "Unidad", "u", False),
    (UUID("20000000-0000-0000-0000-000000000002"), "KG", "Kilogramo", "kg", True),
    (UUID("20000000-0000-0000-0000-000000000003"), "G", "Gramo", "g", True),
    (UUID("20000000-0000-0000-0000-000000000004"), "L", "Litro", "l", True),
    (UUID("20000000-0000-0000-0000-000000000005"), "ML", "Mililitro", "ml", True),
    (UUID("20000000-0000-0000-0000-000000000006"), "CAJ", "Caja", "caja", False),
    (UUID("20000000-0000-0000-0000-000000000007"), "BUL", "Bulto", "bulto", False),
]


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE secuencia_codigo_articulos START WITH 1 INCREMENT BY 1"))

    op.create_table(
        "unidades_medida",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("simbolo", sa.String(20), nullable=False),
        sa.Column("admite_decimales", sa.Boolean(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_unidades_medida"),
        sa.UniqueConstraint("codigo", name="uq_unidades_medida_codigo"),
    )
    op.create_index("ix_unidades_medida_codigo", "unidades_medida", ["codigo"])

    op.create_table(
        "articulos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "codigo",
            sa.String(20),
            server_default=sa.text(
                "'ART' || lpad(nextval('secuencia_codigo_articulos')::text, 6, '0')"
            ),
            nullable=False,
        ),
        sa.Column("descripcion", sa.String(200), nullable=False),
        sa.Column("descripcion_ampliada", sa.Text(), nullable=True),
        sa.Column("habilitado", sa.Boolean(), nullable=False),
        sa.Column("habilitado_venta", sa.Boolean(), nullable=False),
        sa.Column("habilitado_compra", sa.Boolean(), nullable=False),
        sa.Column("habilitado_inventario", sa.Boolean(), nullable=False),
        sa.Column("es_pesable", sa.Boolean(), nullable=False),
        sa.Column("unidad_base_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "fecha_modificacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["unidad_base_id"],
            ["unidades_medida.id"],
            name="fk_articulos_unidad_base_id_unidades_medida",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_articulos"),
        sa.UniqueConstraint("codigo", name="uq_articulos_codigo"),
    )
    op.create_index("ix_articulos_codigo", "articulos", ["codigo"])
    op.create_index("ix_articulos_descripcion", "articulos", ["descripcion"])

    op.create_table(
        "articulos_unidades",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("unidad_medida_id", sa.Uuid(), nullable=False),
        sa.Column("nombre_presentacion", sa.String(100), nullable=False),
        sa.Column("factor_a_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("es_unidad_base", sa.Boolean(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "factor_a_base > 0", name="ck_articulos_unidades_factor_a_base_positivo"
        ),
        sa.ForeignKeyConstraint(
            ["articulo_id"],
            ["articulos.id"],
            name="fk_articulos_unidades_articulo_id_articulos",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["unidad_medida_id"],
            ["unidades_medida.id"],
            name="fk_articulos_unidades_unidad_medida_id_unidades_medida",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_articulos_unidades"),
        sa.UniqueConstraint(
            "articulo_id", "nombre_presentacion", name="uq_articulos_unidades_presentacion"
        ),
    )
    op.create_index("ix_articulos_unidades_articulo_id", "articulos_unidades", ["articulo_id"])

    op.create_table(
        "articulos_codigos_barra",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(80), nullable=False),
        sa.Column("modo_contenido", sa.String(20), nullable=False),
        sa.Column("cantidad", sa.Numeric(18, 6), nullable=False),
        sa.Column("articulo_unidad_id", sa.Uuid(), nullable=True),
        sa.Column("principal", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="ck_articulos_codigos_barra_cantidad_positiva"),
        sa.CheckConstraint(
            "(modo_contenido = 'cantidad' AND articulo_unidad_id IS NULL) OR "
            "(modo_contenido = 'unidad' AND articulo_unidad_id IS NOT NULL)",
            name="ck_articulos_codigos_barra_modo_contenido_valido",
        ),
        sa.ForeignKeyConstraint(
            ["articulo_id"],
            ["articulos.id"],
            name="fk_articulos_codigos_barra_articulo_id_articulos",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["articulo_unidad_id"],
            ["articulos_unidades.id"],
            name="fk_codigos_barra_articulo_unidad",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_articulos_codigos_barra"),
        sa.UniqueConstraint("codigo", name="uq_articulos_codigos_barra_codigo"),
    )
    op.create_index(
        "ix_articulos_codigos_barra_articulo_id", "articulos_codigos_barra", ["articulo_id"]
    )
    op.create_index("ix_articulos_codigos_barra_codigo", "articulos_codigos_barra", ["codigo"])

    op.create_table(
        "proveedores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("razon_social", sa.String(200), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_proveedores"),
        sa.UniqueConstraint("codigo", name="uq_proveedores_codigo"),
    )
    op.create_index("ix_proveedores_codigo", "proveedores", ["codigo"])
    op.create_index("ix_proveedores_razon_social", "proveedores", ["razon_social"])

    op.create_table(
        "articulos_proveedores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("articulo_id", sa.Uuid(), nullable=False),
        sa.Column("proveedor_id", sa.Uuid(), nullable=False),
        sa.Column("codigo_proveedor", sa.String(100), nullable=False),
        sa.Column("principal", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["articulo_id"],
            ["articulos.id"],
            name="fk_articulos_proveedores_articulo_id_articulos",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["proveedor_id"],
            ["proveedores.id"],
            name="fk_articulos_proveedores_proveedor_id_proveedores",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_articulos_proveedores"),
        sa.UniqueConstraint(
            "articulo_id", "proveedor_id", name="uq_articulos_proveedores_articulo_proveedor"
        ),
        sa.UniqueConstraint(
            "proveedor_id", "codigo_proveedor", name="uq_articulos_proveedores_codigo_proveedor"
        ),
    )
    op.create_index(
        "ix_articulos_proveedores_articulo_id", "articulos_proveedores", ["articulo_id"]
    )
    op.create_index(
        "ix_articulos_proveedores_proveedor_id", "articulos_proveedores", ["proveedor_id"]
    )

    tabla_unidades = sa.table(
        "unidades_medida",
        sa.column("id", sa.Uuid()),
        sa.column("codigo"),
        sa.column("nombre"),
        sa.column("simbolo"),
        sa.column("admite_decimales"),
        sa.column("activa"),
    )
    op.bulk_insert(
        tabla_unidades,
        [
            dict(id=i, codigo=c, nombre=n, simbolo=s, admite_decimales=d, activa=True)
            for i, c, n, s, d in UNIDADES
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_articulos_proveedores_proveedor_id", table_name="articulos_proveedores")
    op.drop_index("ix_articulos_proveedores_articulo_id", table_name="articulos_proveedores")
    op.drop_table("articulos_proveedores")
    op.drop_index("ix_proveedores_razon_social", table_name="proveedores")
    op.drop_index("ix_proveedores_codigo", table_name="proveedores")
    op.drop_table("proveedores")
    op.drop_index("ix_articulos_codigos_barra_codigo", table_name="articulos_codigos_barra")
    op.drop_index("ix_articulos_codigos_barra_articulo_id", table_name="articulos_codigos_barra")
    op.drop_table("articulos_codigos_barra")
    op.drop_index("ix_articulos_unidades_articulo_id", table_name="articulos_unidades")
    op.drop_table("articulos_unidades")
    op.drop_index("ix_articulos_descripcion", table_name="articulos")
    op.drop_index("ix_articulos_codigo", table_name="articulos")
    op.drop_table("articulos")
    op.drop_index("ix_unidades_medida_codigo", table_name="unidades_medida")
    op.drop_table("unidades_medida")
    op.execute(sa.text("DROP SEQUENCE secuencia_codigo_articulos"))
