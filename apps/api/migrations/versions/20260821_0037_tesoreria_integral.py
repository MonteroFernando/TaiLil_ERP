"""Tesoreria integral, conciliaciones y cierres de caja.

Revision ID: 20260821_0037
Revises: 20260817_0036
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260821_0037"
down_revision: str | None = "20260817_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cobros_documentos", sa.Column("apertura_caja_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_cobros_documentos_apertura_caja_id_aperturas_cajas",
        "cobros_documentos",
        "aperturas_cajas",
        ["apertura_caja_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_cobros_documentos_apertura_caja_id", "cobros_documentos", ["apertura_caja_id"]
    )
    # Los cobros POS historicos se vinculan a su apertura sin alterar sus importes.
    op.execute("""
        UPDATE cobros_documentos c SET apertura_caja_id = origen.apertura_caja_id
        FROM (
            SELECT i.cobro_id, MIN(v.apertura_caja_id::text)::uuid AS apertura_caja_id
            FROM imputaciones_cobros_ventas i
            JOIN ventas_documentos v ON v.id = i.venta_id
            WHERE v.apertura_caja_id IS NOT NULL GROUP BY i.cobro_id
        ) origen WHERE origen.cobro_id = c.id AND c.apertura_caja_id IS NULL
    """)

    op.add_column(
        "imputaciones_cobros_ventas",
        sa.Column("estado", sa.String(20), server_default="ACTIVA", nullable=False),
    )
    op.add_column("imputaciones_cobros_ventas", sa.Column("usuario_id", sa.Uuid(), nullable=True))
    op.add_column(
        "imputaciones_cobros_ventas",
        sa.Column(
            "fecha_imputacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column(
        "imputaciones_cobros_ventas", sa.Column("anulada_por_id", sa.Uuid(), nullable=True)
    )
    op.add_column(
        "imputaciones_cobros_ventas",
        sa.Column("fecha_anulacion", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "imputaciones_cobros_ventas", sa.Column("motivo_anulacion", sa.String(250), nullable=True)
    )
    op.execute(
        "UPDATE imputaciones_cobros_ventas i SET usuario_id = c.usuario_id "
        "FROM cobros_documentos c WHERE c.id = i.cobro_id"
    )
    op.alter_column("imputaciones_cobros_ventas", "usuario_id", nullable=False)
    op.create_foreign_key(
        "fk_imputaciones_cobros_ventas_usuario_id_usuarios",
        "imputaciones_cobros_ventas",
        "usuarios",
        ["usuario_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_imputaciones_cobros_ventas_anulada_por_id_usuarios",
        "imputaciones_cobros_ventas",
        "usuarios",
        ["anulada_por_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_imputaciones_cobros_ventas_estado", "imputaciones_cobros_ventas", ["estado"]
    )
    op.drop_constraint("uq_imputacion_cobro_venta", "imputaciones_cobros_ventas", type_="unique")
    op.create_index(
        "uq_imputacion_cobro_venta_activa",
        "imputaciones_cobros_ventas",
        ["cobro_id", "venta_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ACTIVA'"),
    )
    op.create_check_constraint("importe_positivo", "imputaciones_cobros_ventas", "importe > 0")
    op.create_check_constraint(
        "estado_valido", "imputaciones_cobros_ventas", "estado IN ('ACTIVA','ANULADA')"
    )

    op.add_column(
        "facturas_compra",
        sa.Column("saldo_pendiente", sa.Numeric(18, 2), server_default="0", nullable=False),
    )
    op.execute(
        "UPDATE facturas_compra SET saldo_pendiente = total_bruto WHERE estado = 'CONFIRMADO'"
    )
    op.create_check_constraint("saldo_no_negativo", "facturas_compra", "saldo_pendiente >= 0")

    op.execute("CREATE SEQUENCE secuencia_pagos START 1")
    op.create_table(
        "pagos_documentos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.BigInteger(), nullable=False),
        sa.Column("proveedor_id", sa.Uuid(), nullable=False),
        sa.Column("apertura_caja_id", sa.Uuid()),
        sa.Column("estado", sa.String(20), server_default="CONFIRMADO", nullable=False),
        sa.Column("total", sa.Numeric(18, 2), nullable=False),
        sa.Column("observacion", sa.Text()),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_realizacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("total > 0", name="ck_pagos_documentos_total_positivo"),
        sa.CheckConstraint(
            "estado IN ('CONFIRMADO','ANULADO')", name="ck_pagos_documentos_estado_valido"
        ),
        sa.ForeignKeyConstraint(["proveedor_id"], ["socios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["apertura_caja_id"], ["aperturas_cajas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
    )
    for col in ("numero", "proveedor_id", "apertura_caja_id", "estado", "fecha_realizacion"):
        op.create_index(f"ix_pagos_documentos_{col}", "pagos_documentos", [col])
    op.create_table(
        "pagos_medios_pago",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pago_id", sa.Uuid(), nullable=False),
        sa.Column("medio", sa.String(30), nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), nullable=False),
        sa.Column("referencia", sa.String(120)),
        sa.CheckConstraint("importe > 0", name="ck_pagos_medios_pago_importe_positivo"),
        sa.ForeignKeyConstraint(["pago_id"], ["pagos_documentos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pagos_medios_pago_pago_id", "pagos_medios_pago", ["pago_id"])
    op.create_table(
        "imputaciones_pagos_facturas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pago_id", sa.Uuid(), nullable=False),
        sa.Column("factura_id", sa.Uuid(), nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), nullable=False),
        sa.Column("estado", sa.String(20), server_default="ACTIVA", nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_imputacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("anulada_por_id", sa.Uuid()),
        sa.Column("fecha_anulacion", sa.DateTime(timezone=True)),
        sa.Column("motivo_anulacion", sa.String(250)),
        sa.CheckConstraint("importe > 0", name="ck_imputaciones_pagos_facturas_importe_positivo"),
        sa.CheckConstraint(
            "estado IN ('ACTIVA','ANULADA')", name="ck_imputaciones_pagos_facturas_estado_valido"
        ),
        sa.ForeignKeyConstraint(["pago_id"], ["pagos_documentos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["factura_id"], ["facturas_compra.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["anulada_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for col in ("pago_id", "factura_id", "estado"):
        op.create_index(
            f"ix_imputaciones_pagos_facturas_{col}", "imputaciones_pagos_facturas", [col]
        )
    op.create_index(
        "uq_imputacion_pago_factura_activa",
        "imputaciones_pagos_facturas",
        ["pago_id", "factura_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ACTIVA'"),
    )

    op.create_table(
        "movimientos_caja",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("apertura_caja_id", sa.Uuid(), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("medio", sa.String(30), server_default="EFECTIVO", nullable=False),
        sa.Column("importe", sa.Numeric(18, 2), nullable=False),
        sa.Column("concepto", sa.String(200), nullable=False),
        sa.Column("estado", sa.String(20), server_default="CONFIRMADO", nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha_realizacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("tipo IN ('INGRESO','EGRESO')", name="ck_movimientos_caja_tipo_valido"),
        sa.CheckConstraint("importe > 0", name="ck_movimientos_caja_importe_positivo"),
        sa.ForeignKeyConstraint(["apertura_caja_id"], ["aperturas_cajas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for col in ("apertura_caja_id", "estado", "fecha_realizacion"):
        op.create_index(f"ix_movimientos_caja_{col}", "movimientos_caja", [col])
    op.create_table(
        "arqueos_caja",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("apertura_caja_id", sa.Uuid(), nullable=False),
        sa.Column("total_declarado", sa.Numeric(18, 2), nullable=False),
        sa.Column("observacion", sa.Text()),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("total_declarado >= 0", name="ck_arqueos_caja_total_no_negativo"),
        sa.ForeignKeyConstraint(["apertura_caja_id"], ["aperturas_cajas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_arqueos_caja_apertura_caja_id", "arqueos_caja", ["apertura_caja_id"])
    op.create_index("ix_arqueos_caja_fecha", "arqueos_caja", ["fecha"])
    op.create_table(
        "arqueos_caja_detalles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("arqueo_id", sa.Uuid(), nullable=False),
        sa.Column("denominacion", sa.Numeric(18, 2), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("subtotal", sa.Numeric(18, 2), nullable=False),
        sa.CheckConstraint("denominacion > 0", name="ck_arqueos_detalle_denominacion_positiva"),
        sa.CheckConstraint("cantidad >= 0", name="ck_arqueos_detalle_cantidad_no_negativa"),
        sa.ForeignKeyConstraint(["arqueo_id"], ["arqueos_caja.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("arqueo_id", "denominacion", name="uq_arqueo_denominacion"),
    )
    op.create_index("ix_arqueos_caja_detalles_arqueo_id", "arqueos_caja_detalles", ["arqueo_id"])
    op.create_table(
        "cierres_caja",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("apertura_caja_id", sa.Uuid(), nullable=False),
        sa.Column("total_ventas", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_cobros", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_pagos", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_ingresos", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_egresos", sa.Numeric(18, 2), nullable=False),
        sa.Column("efectivo_esperado", sa.Numeric(18, 2), nullable=False),
        sa.Column("efectivo_declarado", sa.Numeric(18, 2), nullable=False),
        sa.Column("diferencia", sa.Numeric(18, 2), nullable=False),
        sa.Column("cantidad_ventas", sa.Integer(), nullable=False),
        sa.Column("observacion", sa.Text()),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "fecha", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["apertura_caja_id"], ["aperturas_cajas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("apertura_caja_id"),
    )
    op.create_index("ix_cierres_caja_apertura_caja_id", "cierres_caja", ["apertura_caja_id"])
    op.create_index("ix_cierres_caja_fecha", "cierres_caja", ["fecha"])
    op.create_table(
        "cierres_caja_medios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cierre_id", sa.Uuid(), nullable=False),
        sa.Column("medio", sa.String(30), nullable=False),
        sa.Column("esperado", sa.Numeric(18, 2), nullable=False),
        sa.Column("declarado", sa.Numeric(18, 2), nullable=False),
        sa.Column("diferencia", sa.Numeric(18, 2), nullable=False),
        sa.ForeignKeyConstraint(["cierre_id"], ["cierres_caja.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cierre_id", "medio", name="uq_cierre_medio"),
    )
    op.create_index("ix_cierres_caja_medios_cierre_id", "cierres_caja_medios", ["cierre_id"])

    # Los permisos ya existian: se incorporan a los perfiles de sistema de instalaciones previas.
    op.execute(
        """INSERT INTO perfiles_permisos (perfil_id, permiso_id)
        SELECT p.id, pe.id FROM perfiles_acceso p CROSS JOIN permisos pe
        WHERE p.es_sistema = true
          AND pe.codigo IN ('tesoreria.ver','tesoreria.gestionar')
        ON CONFLICT DO NOTHING"""
    )


def downgrade() -> None:
    for tabla in (
        "cierres_caja_medios",
        "cierres_caja",
        "arqueos_caja_detalles",
        "arqueos_caja",
        "movimientos_caja",
        "imputaciones_pagos_facturas",
        "pagos_medios_pago",
        "pagos_documentos",
    ):
        op.drop_table(tabla)
    op.execute("DROP SEQUENCE secuencia_pagos")
    op.drop_constraint("ck_facturas_compra_saldo_no_negativo", "facturas_compra", type_="check")
    op.drop_column("facturas_compra", "saldo_pendiente")
    op.drop_constraint(
        "ck_imputaciones_cobros_ventas_estado_valido", "imputaciones_cobros_ventas", type_="check"
    )
    op.drop_constraint(
        "ck_imputaciones_cobros_ventas_importe_positivo",
        "imputaciones_cobros_ventas",
        type_="check",
    )
    op.drop_index("ix_imputaciones_cobros_ventas_estado", table_name="imputaciones_cobros_ventas")
    op.drop_index("uq_imputacion_cobro_venta_activa", table_name="imputaciones_cobros_ventas")
    op.create_unique_constraint(
        "uq_imputacion_cobro_venta",
        "imputaciones_cobros_ventas",
        ["cobro_id", "venta_id"],
    )
    op.drop_constraint(
        "fk_imputaciones_cobros_ventas_anulada_por_id_usuarios",
        "imputaciones_cobros_ventas",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_imputaciones_cobros_ventas_usuario_id_usuarios",
        "imputaciones_cobros_ventas",
        type_="foreignkey",
    )
    for col in (
        "motivo_anulacion",
        "fecha_anulacion",
        "anulada_por_id",
        "fecha_imputacion",
        "usuario_id",
        "estado",
    ):
        op.drop_column("imputaciones_cobros_ventas", col)
    op.drop_index("ix_cobros_documentos_apertura_caja_id", table_name="cobros_documentos")
    op.drop_constraint(
        "fk_cobros_documentos_apertura_caja_id_aperturas_cajas",
        "cobros_documentos",
        type_="foreignkey",
    )
    op.drop_column("cobros_documentos", "apertura_caja_id")
