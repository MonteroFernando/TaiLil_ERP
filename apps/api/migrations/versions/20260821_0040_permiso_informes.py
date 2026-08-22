"""Agregar permiso independiente para el modulo de informes.

Revision ID: 20260821_0040
Revises: 20260821_0039
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260821_0040"
down_revision: str | None = "20260821_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISO_ID = "10000000-0000-0000-0000-000000000016"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO permisos (id, codigo, modulo, accion, descripcion)
        VALUES ('{PERMISO_ID}', 'informes.ver', 'informes', 'ver',
                'Consultar flujo de dinero, ventas, costos y margenes')
        ON CONFLICT (codigo) DO NOTHING
        """
    )
    # Conserva el acceso de los perfiles que ya podian consultar Tesoreria.
    # Luego el administrador puede quitar o asignar Informes de forma independiente.
    op.execute(
        """
        INSERT INTO perfiles_permisos (perfil_id, permiso_id)
        SELECT pp.perfil_id, informe.id
        FROM perfiles_permisos pp
        JOIN permisos tesoreria ON tesoreria.id = pp.permiso_id
        CROSS JOIN permisos informe
        WHERE tesoreria.codigo = 'tesoreria.ver'
          AND informe.codigo = 'informes.ver'
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM permisos WHERE id = '{PERMISO_ID}'")
