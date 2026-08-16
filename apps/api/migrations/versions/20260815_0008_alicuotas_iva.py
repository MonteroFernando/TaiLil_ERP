"""Agregar catalogo de alicuotas de IVA a los articulos.

Revision ID: 20260815_0008
Revises: 20260815_0007
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0008"
down_revision: str | None = "20260815_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALICUOTAS = [
    (UUID("30000000-0000-0000-0000-000000000001"), "IVA_0", "IVA 0%", 0),
    (UUID("30000000-0000-0000-0000-000000000002"), "IVA_10_5", "IVA 10,5%", 10.5),
    (UUID("30000000-0000-0000-0000-000000000003"), "IVA_21", "IVA 21%", 21),
    (UUID("30000000-0000-0000-0000-000000000004"), "IVA_27", "IVA 27%", 27),
]


def upgrade() -> None:
    op.create_table(
        "alicuotas_iva",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_alicuotas_iva"),
        sa.UniqueConstraint("codigo", name="uq_alicuotas_iva_codigo"),
        sa.UniqueConstraint("porcentaje", name="uq_alicuotas_iva_porcentaje"),
    )
    op.create_index("ix_alicuotas_iva_codigo", "alicuotas_iva", ["codigo"])
    tabla = sa.table(
        "alicuotas_iva",
        sa.column("id", sa.Uuid()),
        sa.column("codigo", sa.String()),
        sa.column("nombre", sa.String()),
        sa.column("porcentaje", sa.Numeric()),
        sa.column("activa", sa.Boolean()),
    )
    op.bulk_insert(
        tabla,
        [
            {
                "id": identificador,
                "codigo": codigo,
                "nombre": nombre,
                "porcentaje": porcentaje,
                "activa": True,
            }
            for identificador, codigo, nombre, porcentaje in ALICUOTAS
        ],
    )
    iva_21_id = ALICUOTAS[2][0]
    op.add_column("articulos", sa.Column("alicuota_iva_id", sa.Uuid(), nullable=True))
    op.execute(
        sa.text("UPDATE articulos SET alicuota_iva_id = :iva_id").bindparams(iva_id=iva_21_id)
    )
    op.alter_column("articulos", "alicuota_iva_id", nullable=False)
    op.create_foreign_key(
        "fk_articulos_alicuota_iva_id_alicuotas_iva",
        "articulos",
        "alicuotas_iva",
        ["alicuota_iva_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_articulos_alicuota_iva_id_alicuotas_iva",
        "articulos",
        type_="foreignkey",
    )
    op.drop_column("articulos", "alicuota_iva_id")
    op.drop_index("ix_alicuotas_iva_codigo", table_name="alicuotas_iva")
    op.drop_table("alicuotas_iva")
