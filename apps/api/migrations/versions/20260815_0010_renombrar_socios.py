"""Renombrar terceros como socios comerciales.

Revision ID: 20260815_0010
Revises: 20260815_0009
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260815_0010"
down_revision: str | None = "20260815_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table("terceros", "socios")
    op.rename_table("terceros_domicilios", "socios_domicilios")
    op.alter_column("socios_domicilios", "tercero_id", new_column_name="socio_id")

    renombres = [
        ("socios", "pk_terceros", "pk_socios"),
        ("socios", "uq_terceros_codigo", "uq_socios_codigo"),
        ("socios", "uq_terceros_numero_documento", "uq_socios_numero_documento"),
        ("socios_domicilios", "pk_terceros_domicilios", "pk_socios_domicilios"),
        (
            "socios_domicilios",
            "fk_terceros_domicilios_tercero_id_terceros",
            "fk_socios_domicilios_socio_id_socios",
        ),
        (
            "articulos_proveedores",
            "fk_articulos_proveedores_proveedor_id_terceros",
            "fk_articulos_proveedores_proveedor_id_socios",
        ),
    ]
    for tabla, anterior, nuevo in renombres:
        op.execute(f'ALTER TABLE "{tabla}" RENAME CONSTRAINT "{anterior}" TO "{nuevo}"')

    indices = [
        ("ix_terceros_codigo", "ix_socios_codigo"),
        ("ix_terceros_razon_social", "ix_socios_razon_social"),
        ("ix_terceros_numero_documento", "ix_socios_numero_documento"),
        ("ix_terceros_domicilios_tercero_id", "ix_socios_domicilios_socio_id"),
    ]
    for anterior, nuevo in indices:
        op.execute(f'ALTER INDEX "{anterior}" RENAME TO "{nuevo}"')


def downgrade() -> None:
    raise RuntimeError("El renombre a socios no admite downgrade automatico")
