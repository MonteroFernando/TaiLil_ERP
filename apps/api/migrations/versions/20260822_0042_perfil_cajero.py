"""Agregar permisos operativos y perfil de cajero.

Revision ID: 20260822_0042
Revises: 20260821_0041
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260822_0042"
down_revision: str | None = "20260821_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERFIL_CAJERO_ID = "00000000-0000-0000-0000-000000000002"
PERMISO_OPERAR_ID = "10000000-0000-0000-0000-000000000017"
PERMISO_CERRAR_ID = "10000000-0000-0000-0000-000000000018"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO permisos (id, codigo, modulo, accion, descripcion) VALUES
          ('{PERMISO_OPERAR_ID}', 'ventas.caja.operar', 'ventas', 'caja_operar',
           'Abrir y operar la caja propia desde el punto de venta'),
          ('{PERMISO_CERRAR_ID}', 'ventas.caja.cerrar', 'ventas', 'caja_cerrar',
           'Controlar y cerrar exclusivamente la caja propia')
        ON CONFLICT (codigo) DO NOTHING
        """
    )
    op.execute(
        f"""
        INSERT INTO perfiles_acceso (id, nombre, descripcion, activo, es_sistema)
        VALUES ('{PERFIL_CAJERO_ID}', 'CAJERO',
                'Opera el punto de venta y realiza el cierre de su propia caja', true, true)
        ON CONFLICT (nombre) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO perfiles_permisos (perfil_id, permiso_id)
        SELECT perfil.id, permiso.id
        FROM perfiles_acceso perfil
        JOIN permisos permiso
          ON permiso.codigo IN ('ventas.caja.operar', 'ventas.caja.cerrar')
        WHERE perfil.nombre = 'CAJERO'
        ON CONFLICT DO NOTHING
        """
    )
    # Los perfiles de sistema con gestion completa de ventas conservan acceso al POS.
    op.execute(
        """
        INSERT INTO perfiles_permisos (perfil_id, permiso_id)
        SELECT pp.perfil_id, nuevo.id
        FROM perfiles_permisos pp
        JOIN permisos actual ON actual.id = pp.permiso_id
        CROSS JOIN permisos nuevo
        WHERE actual.codigo = 'ventas.gestionar'
          AND nuevo.codigo IN ('ventas.caja.operar', 'ventas.caja.cerrar')
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        f"DELETE FROM perfiles_acceso WHERE id = '{PERFIL_CAJERO_ID}' AND nombre = 'CAJERO'"
    )
    op.execute(
        f"DELETE FROM permisos WHERE id IN ('{PERMISO_OPERAR_ID}', '{PERMISO_CERRAR_ID}')"
    )
