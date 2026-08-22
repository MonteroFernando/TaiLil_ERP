"""Registrar stock inicial y conteos sin diferencia.

Revision ID: 20260821_0038
Revises: 20260821_0037
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260821_0038"
down_revision: str | None = "20260821_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Los ceros representan controles fisicos confirmados, no ajustes de existencia.
    # Se busca por definicion porque PostgreSQL pudo truncar el nombre historico a 63 caracteres.
    op.execute(
        """
        DO $$
        DECLARE nombre_restriccion text;
        BEGIN
            SELECT conname INTO nombre_restriccion
            FROM pg_constraint
            WHERE conrelid = 'movimientos_stock_detalles'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%cantidad_base%<>%0%'
            LIMIT 1;
            IF nombre_restriccion IS NOT NULL THEN
                EXECUTE format(
                    'ALTER TABLE movimientos_stock_detalles DROP CONSTRAINT %I',
                    nombre_restriccion
                );
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Un downgrade solo es posible si no se registraron conteos sin diferencia.
    op.execute(
        "ALTER TABLE movimientos_stock_detalles "
        "ADD CONSTRAINT ck_mov_stock_det_cantidad_no_cero CHECK (cantidad_base <> 0)"
    )
