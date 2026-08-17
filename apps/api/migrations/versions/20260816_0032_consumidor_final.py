"""Crear el cliente predeterminado consumidor final.

Revision ID: 20260816_0032
Revises: 20260816_0031
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260816_0032"
down_revision: str | None = "20260816_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO socios (
            id, codigo, razon_social, nombre_fantasia, tipo_persona,
            tipo_documento, numero_documento, condicion_iva_codigo,
            es_proveedor, es_cliente, activo
        )
        SELECT
            '00000000-0000-0000-0000-000000000001',
            'CONSUMIDOR_FINAL', 'CONSUMIDOR FINAL', 'CONSUMIDOR FINAL',
            'fisica', 'DNI', '00000000', 5, false, true, true
        WHERE NOT EXISTS (
            SELECT 1 FROM socios WHERE codigo = 'CONSUMIDOR_FINAL'
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM socios
        WHERE codigo = 'CONSUMIDOR_FINAL'
          AND NOT EXISTS (
              SELECT 1 FROM ventas_documentos
              WHERE cliente_id = socios.id
          )
        """
    )
