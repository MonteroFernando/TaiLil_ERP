"""Agregar autorizacion expresa para emitir notas de credito.

Revision ID: 20260822_0044
Revises: 20260822_0043
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260822_0044"
down_revision: str | None = "20260822_0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISO_ID = "10000000-0000-0000-0000-000000000019"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO permisos (id, codigo, modulo, accion, descripcion)
        VALUES ('{PERMISO_ID}', 'ventas.notas_credito.emitir', 'ventas',
                'notas_credito_emitir',
                'Emitir notas de credito de clientes desde POS o Tesoreria')
        ON CONFLICT (codigo) DO NOTHING
        """
    )
    # Es una autorizacion sensible: no se hereda a ningun perfil, incluido CAJERO.
    # El administrador debe asignarla expresamente a un perfil o usuario.


def downgrade() -> None:
    op.execute(f"DELETE FROM permisos WHERE id = '{PERMISO_ID}'")
