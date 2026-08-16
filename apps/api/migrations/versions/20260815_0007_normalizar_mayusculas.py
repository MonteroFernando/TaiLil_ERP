"""Normalizar textos de negocio existentes a mayusculas.

Revision ID: 20260815_0007
Revises: 20260815_0006
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260815_0007"
down_revision: str | None = "20260815_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    normalizaciones = {
        "usuarios": ["nombre_usuario"],
        "permisos": ["descripcion"],
        "perfiles_acceso": ["nombre", "descripcion"],
        "unidades_medida": ["codigo", "nombre", "simbolo"],
        "articulos": ["codigo", "descripcion", "descripcion_ampliada"],
        "articulos_unidades": ["nombre_presentacion"],
        "articulos_codigos_barra": ["codigo"],
        "proveedores": ["codigo", "razon_social"],
        "articulos_proveedores": ["codigo_proveedor"],
    }
    for tabla, columnas in normalizaciones.items():
        for columna in columnas:
            op.execute(
                f'UPDATE "{tabla}" SET "{columna}" = UPPER(TRIM("{columna}")) '
                f'WHERE "{columna}" IS NOT NULL'
            )


def downgrade() -> None:
    # La capitalizacion original no puede reconstruirse de forma segura.
    pass
