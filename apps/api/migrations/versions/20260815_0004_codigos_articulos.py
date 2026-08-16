"""Cambiar identificacion de articulos.

Revision ID: 20260815_0004
Revises: 20260815_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0004"
down_revision: str | None = "20260815_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "articulos",
        sa.Column("tipo_articulo", sa.String(20), server_default="producto", nullable=False),
    )
    op.alter_column("articulos", "codigo", server_default=None)
    op.execute(
        sa.text(
            "UPDATE articulos "
            "SET codigo = lpad((substring(codigo from 4))::integer::text, 5, '0') "
            "WHERE codigo ~ '^ART[0-9]{6}$'"
        )
    )
    op.create_check_constraint(
        "ck_articulos_tipo_articulo_valido",
        "articulos",
        "tipo_articulo IN ('producto', 'servicio')",
    )
    op.create_check_constraint(
        "ck_articulos_servicio_sin_inventario",
        "articulos",
        "tipo_articulo = 'producto' OR (habilitado_inventario = false AND es_pesable = false)",
    )
    op.execute(
        sa.text(
            "DO $$ "
            "DECLARE ultimo integer; "
            "BEGIN "
            "SELECT COALESCE(MAX(codigo::integer), 0) INTO ultimo "
            "FROM articulos WHERE codigo ~ '^[0-9]{5}$'; "
            "IF ultimo = 0 THEN "
            "PERFORM setval('secuencia_codigo_articulos', 1, false); "
            "ELSE "
            "PERFORM setval('secuencia_codigo_articulos', ultimo, true); "
            "END IF; "
            "END $$"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE articulos SET codigo = 'ART' || lpad(codigo, 6, '0') "
            "WHERE tipo_articulo = 'producto' AND codigo ~ '^[0-9]{5}$'"
        )
    )
    op.alter_column(
        "articulos",
        "codigo",
        server_default=sa.text(
            "'ART' || lpad(nextval('secuencia_codigo_articulos')::text, 6, '0')"
        ),
    )
    op.drop_constraint("ck_articulos_servicio_sin_inventario", "articulos", type_="check")
    op.drop_constraint("ck_articulos_tipo_articulo_valido", "articulos", type_="check")
    op.drop_column("articulos", "tipo_articulo")
