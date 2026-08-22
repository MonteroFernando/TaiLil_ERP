"""Permitir completar conciliaciones parciales conservando cada aplicacion.

Revision ID: 20260822_0046
Revises: 20260822_0045
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0046"
down_revision: str | None = "20260822_0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Una misma pareja cobro/factura o pago/factura puede recibir aplicaciones
    # parciales en distintos momentos. Cada renglon conserva fecha y usuario.
    op.drop_index(
        "uq_imputacion_cobro_venta_activa",
        table_name="imputaciones_cobros_ventas",
    )
    op.drop_index(
        "uq_imputacion_pago_factura_activa",
        table_name="imputaciones_pagos_facturas",
    )


def downgrade() -> None:
    op.create_index(
        "uq_imputacion_pago_factura_activa",
        "imputaciones_pagos_facturas",
        ["pago_id", "factura_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ACTIVA'"),
    )
    op.create_index(
        "uq_imputacion_cobro_venta_activa",
        "imputaciones_cobros_ventas",
        ["cobro_id", "venta_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ACTIVA'"),
    )
