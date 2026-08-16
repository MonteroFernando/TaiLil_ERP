"""Crear permisos y perfiles de acceso.

Revision ID: 20260815_0002
Revises: 20260815_0001
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "20260815_0002"
down_revision: str | None = "20260815_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERFIL_ADMIN_ID = UUID("00000000-0000-0000-0000-000000000001")
PERMISOS = [
    (
        UUID("10000000-0000-0000-0000-000000000001"),
        "configuracion.accesos.ver",
        "configuracion",
        "ver",
        "Ver usuarios, perfiles y permisos",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000002"),
        "configuracion.accesos.gestionar",
        "configuracion",
        "gestionar",
        "Administrar usuarios, perfiles y permisos",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000003"),
        "datos_maestros.ver",
        "datos_maestros",
        "ver",
        "Consultar datos maestros",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000004"),
        "datos_maestros.gestionar",
        "datos_maestros",
        "gestionar",
        "Crear y modificar datos maestros",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000005"),
        "inventario.ver",
        "inventario",
        "ver",
        "Consultar inventario",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000006"),
        "inventario.gestionar",
        "inventario",
        "gestionar",
        "Registrar movimientos y ajustes",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000007"),
        "ventas.ver",
        "ventas",
        "ver",
        "Consultar ventas",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000008"),
        "ventas.gestionar",
        "ventas",
        "gestionar",
        "Crear y modificar operaciones de venta",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000009"),
        "compras.ver",
        "compras",
        "ver",
        "Consultar compras",
    ),
    (
        UUID("10000000-0000-0000-0000-000000000010"),
        "compras.gestionar",
        "compras",
        "gestionar",
        "Crear y modificar operaciones de compra",
    ),
]


def upgrade() -> None:
    op.create_table(
        "permisos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(120), nullable=False),
        sa.Column("modulo", sa.String(80), nullable=False),
        sa.Column("accion", sa.String(80), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_permisos"),
        sa.UniqueConstraint("codigo", name="uq_permisos_codigo"),
    )
    op.create_index("ix_permisos_codigo", "permisos", ["codigo"])
    op.create_index("ix_permisos_modulo", "permisos", ["modulo"])
    op.create_table(
        "perfiles_acceso",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("es_sistema", sa.Boolean(), nullable=False),
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_perfiles_acceso"),
        sa.UniqueConstraint("nombre", name="uq_perfiles_acceso_nombre"),
    )
    op.create_index("ix_perfiles_acceso_nombre", "perfiles_acceso", ["nombre"])
    op.create_table(
        "perfiles_permisos",
        sa.Column("perfil_id", sa.Uuid(), nullable=False),
        sa.Column("permiso_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["perfil_id"],
            ["perfiles_acceso.id"],
            name="fk_perfiles_permisos_perfil_id_perfiles_acceso",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permiso_id"],
            ["permisos.id"],
            name="fk_perfiles_permisos_permiso_id_permisos",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("perfil_id", "permiso_id", name="pk_perfiles_permisos"),
    )
    op.create_table(
        "usuarios_perfiles",
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("perfil_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            name="fk_usuarios_perfiles_usuario_id_usuarios",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["perfil_id"],
            ["perfiles_acceso.id"],
            name="fk_usuarios_perfiles_perfil_id_perfiles_acceso",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("usuario_id", "perfil_id", name="pk_usuarios_perfiles"),
    )
    op.create_table(
        "usuarios_permisos",
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("permiso_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            name="fk_usuarios_permisos_usuario_id_usuarios",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permiso_id"],
            ["permisos.id"],
            name="fk_usuarios_permisos_permiso_id_permisos",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("usuario_id", "permiso_id", name="pk_usuarios_permisos"),
    )

    tabla_permisos = sa.table(
        "permisos",
        sa.column("id", sa.Uuid()),
        sa.column("codigo"),
        sa.column("modulo"),
        sa.column("accion"),
        sa.column("descripcion"),
    )
    op.bulk_insert(
        tabla_permisos,
        [dict(id=i, codigo=c, modulo=m, accion=a, descripcion=d) for i, c, m, a, d in PERMISOS],
    )
    op.execute(
        sa.text(
            "INSERT INTO perfiles_acceso "
            "(id, nombre, descripcion, activo, es_sistema) "
            "VALUES (:id, 'Administradores', 'Acceso completo al sistema', true, true)"
        ).bindparams(id=PERFIL_ADMIN_ID)
    )
    for permiso_id, *_ in PERMISOS:
        op.execute(
            sa.text(
                "INSERT INTO perfiles_permisos (perfil_id, permiso_id) VALUES (:perfil, :permiso)"
            ).bindparams(perfil=PERFIL_ADMIN_ID, permiso=permiso_id)
        )
    op.execute(
        sa.text(
            "INSERT INTO usuarios_perfiles (usuario_id, perfil_id) "
            "SELECT id, :perfil FROM usuarios WHERE es_administrador = true "
            "ON CONFLICT DO NOTHING"
        ).bindparams(perfil=PERFIL_ADMIN_ID)
    )


def downgrade() -> None:
    op.drop_table("usuarios_permisos")
    op.drop_table("usuarios_perfiles")
    op.drop_table("perfiles_permisos")
    op.drop_index("ix_perfiles_acceso_nombre", table_name="perfiles_acceso")
    op.drop_table("perfiles_acceso")
    op.drop_index("ix_permisos_modulo", table_name="permisos")
    op.drop_index("ix_permisos_codigo", table_name="permisos")
    op.drop_table("permisos")
