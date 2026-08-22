"""Guardar el costo historico de cada linea vendida.

Revision ID: 20260821_0039
Revises: 20260821_0038
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260821_0039"
down_revision: str | None = "20260821_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ventas_documentos_detalles",
        sa.Column(
            "costo_unitario_bruto",
            sa.Numeric(18, 6),
            nullable=False,
            server_default="0",
        ),
    )
    # Para el historico previo se toma la mejor referencia disponible al migrar.
    op.execute(
        """
        UPDATE ventas_documentos_detalles detalle
        SET costo_unitario_bruto = precio.precio_bruto
        FROM precios_articulos_base precio
        WHERE precio.articulo_id = detalle.articulo_id
        """
    )
    op.alter_column("ventas_documentos_detalles", "costo_unitario_bruto", server_default=None)


def downgrade() -> None:
    op.drop_column("ventas_documentos_detalles", "costo_unitario_bruto")
