"""Agregar letra, punto de emision y numero a las facturas de compra.

Revision ID: 20260822_0048
Revises: 20260822_0047
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0048"
down_revision: str | None = "20260822_0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("facturas_compra", sa.Column("letra", sa.String(1), nullable=True))
    op.add_column(
        "facturas_compra", sa.Column("punto_emision", sa.String(5), nullable=True)
    )
    op.add_column(
        "facturas_compra", sa.Column("numero_factura", sa.String(20), nullable=True)
    )

    # Los comprobantes historicos conservan intacta su referencia anterior. Cuando
    # el texto ya tiene formato fiscal se separan sus partes; el resto queda marcado
    # como legado (X 00000-<referencia>) para no inventar datos ni perder registros.
    op.execute(
        """
        UPDATE facturas_compra
        SET letra = upper(substring(numero_proveedor from '^\\s*([A-Za-z])')),
            punto_emision = lpad(
                substring(numero_proveedor from '[A-Za-z]\\s*([0-9]{1,5})\\s*-'),
                5,
                '0'
            ),
            numero_factura = lpad(
                substring(numero_proveedor from '-\\s*([0-9]{1,20})\\s*$'),
                8,
                '0'
            )
        WHERE numero_proveedor ~* '^\\s*[A-Za-z]\\s*[0-9]{1,5}\\s*-\\s*[0-9]{1,20}\\s*$'
        """
    )
    op.execute(
        """
        UPDATE facturas_compra
        SET letra = 'X',
            punto_emision = '00000',
            numero_factura = left(regexp_replace(numero_proveedor, '[^A-Za-z0-9]', '', 'g'), 20)
        WHERE letra IS NULL
        """
    )
    op.execute(
        """
        UPDATE facturas_compra
        SET numero_factura = left(replace(id::text, '-', ''), 20)
        WHERE numero_factura IS NULL OR numero_factura = ''
        """
    )

    # Si dos referencias historicas distintas se normalizan al mismo comprobante,
    # se conserva la primera y las restantes quedan como legadas. numero_proveedor
    # no se modifica, por lo que la identificacion original sigue visible.
    op.execute(
        """
        WITH duplicadas AS (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY proveedor_id, letra, punto_emision, numero_factura
                       ORDER BY fecha_realizacion, id
                   ) AS posicion
            FROM facturas_compra
        )
        UPDATE facturas_compra AS factura
        SET letra = 'X',
            punto_emision = '00000',
            numero_factura = left(replace(factura.id::text, '-', ''), 20)
        FROM duplicadas
        WHERE duplicadas.id = factura.id
          AND duplicadas.posicion > 1
        """
    )

    op.alter_column("facturas_compra", "letra", nullable=False)
    op.alter_column("facturas_compra", "punto_emision", nullable=False)
    op.alter_column("facturas_compra", "numero_factura", nullable=False)
    op.create_index("ix_facturas_compra_letra", "facturas_compra", ["letra"])
    op.create_index(
        "ix_facturas_compra_punto_emision", "facturas_compra", ["punto_emision"]
    )
    op.create_index(
        "ix_facturas_compra_numero_factura", "facturas_compra", ["numero_factura"]
    )
    op.create_unique_constraint(
        "uq_factura_compra_comprobante_proveedor",
        "facturas_compra",
        ["proveedor_id", "letra", "punto_emision", "numero_factura"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_factura_compra_comprobante_proveedor",
        "facturas_compra",
        type_="unique",
    )
    op.drop_index("ix_facturas_compra_numero_factura", table_name="facturas_compra")
    op.drop_index("ix_facturas_compra_punto_emision", table_name="facturas_compra")
    op.drop_index("ix_facturas_compra_letra", table_name="facturas_compra")
    op.drop_column("facturas_compra", "numero_factura")
    op.drop_column("facturas_compra", "punto_emision")
    op.drop_column("facturas_compra", "letra")
