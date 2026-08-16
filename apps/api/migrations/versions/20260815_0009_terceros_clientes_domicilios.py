"""Unificar proveedores y clientes con datos fiscales y domicilios.

Revision ID: 20260815_0009
Revises: 20260815_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0009"
down_revision: str | None = "20260815_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "terceros",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("razon_social", sa.String(200), nullable=False),
        sa.Column("nombre_fantasia", sa.String(200), nullable=True),
        sa.Column("tipo_persona", sa.String(10), nullable=False),
        sa.Column("tipo_documento", sa.String(20), nullable=False),
        sa.Column("numero_documento", sa.String(20), nullable=False),
        sa.Column("condicion_iva_codigo", sa.Integer(), nullable=False),
        sa.Column("condicion_iibb", sa.String(30), nullable=True),
        sa.Column("numero_iibb", sa.String(30), nullable=True),
        sa.Column("actividad_arca_codigo", sa.String(20), nullable=True),
        sa.Column("actividad_arca_descripcion", sa.String(200), nullable=True),
        sa.Column("es_proveedor", sa.Boolean(), nullable=False),
        sa.Column("es_cliente", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_terceros"),
        sa.UniqueConstraint("codigo", name="uq_terceros_codigo"),
        sa.UniqueConstraint("numero_documento", name="uq_terceros_numero_documento"),
    )
    op.create_index("ix_terceros_codigo", "terceros", ["codigo"])
    op.create_index("ix_terceros_razon_social", "terceros", ["razon_social"])
    op.create_index("ix_terceros_numero_documento", "terceros", ["numero_documento"])
    op.execute(
        """
        INSERT INTO terceros (
            id, codigo, razon_social, tipo_persona, tipo_documento,
            numero_documento, condicion_iva_codigo, es_proveedor, es_cliente, activo
        )
        SELECT id, codigo, razon_social, 'juridica', 'CUIT',
               LEFT('PENDIENTE-' || codigo, 20), 7, true, false, activo
        FROM proveedores
        """
    )
    op.drop_constraint(
        "fk_articulos_proveedores_proveedor_id_proveedores",
        "articulos_proveedores",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_articulos_proveedores_proveedor_id_terceros",
        "articulos_proveedores",
        "terceros",
        ["proveedor_id"],
        ["id"],
    )
    op.drop_index("ix_proveedores_razon_social", table_name="proveedores")
    op.drop_index("ix_proveedores_codigo", table_name="proveedores")
    op.drop_table("proveedores")

    op.create_table(
        "terceros_domicilios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tercero_id", sa.Uuid(), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("calle", sa.String(150), nullable=False),
        sa.Column("numero", sa.String(20), nullable=False),
        sa.Column("localidad", sa.String(100), nullable=False),
        sa.Column("provincia", sa.String(100), nullable=False),
        sa.Column("pais", sa.String(100), nullable=False),
        sa.Column("codigo_postal", sa.String(20), nullable=True),
        sa.Column("contacto", sa.String(150), nullable=True),
        sa.Column("telefono", sa.String(50), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("es_principal", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tercero_id"],
            ["terceros.id"],
            name="fk_terceros_domicilios_tercero_id_terceros",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_terceros_domicilios"),
    )
    op.create_index("ix_terceros_domicilios_tercero_id", "terceros_domicilios", ["tercero_id"])


def downgrade() -> None:
    raise RuntimeError("La unificacion de terceros no admite downgrade automatico")
