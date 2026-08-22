from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class PagoDocumento(Base):
    __tablename__ = "pagos_documentos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    numero: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    proveedor_id: Mapped[UUID] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), index=True
    )
    apertura_caja_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("aperturas_cajas.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    estado: Mapped[str] = mapped_column(String(20), default="CONFIRMADO", index=True)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha_realizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class PagoMedioPago(Base):
    __tablename__ = "pagos_medios_pago"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pago_id: Mapped[UUID] = mapped_column(
        ForeignKey("pagos_documentos.id", ondelete="RESTRICT"), index=True
    )
    medio: Mapped[str] = mapped_column(String(30))
    importe: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    referencia: Mapped[str | None] = mapped_column(String(120), nullable=True)


class ImputacionPagoFactura(Base):
    __tablename__ = "imputaciones_pagos_facturas"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pago_id: Mapped[UUID] = mapped_column(
        ForeignKey("pagos_documentos.id", ondelete="RESTRICT"), index=True
    )
    factura_id: Mapped[UUID] = mapped_column(
        ForeignKey("facturas_compra.id", ondelete="RESTRICT"), index=True
    )
    importe: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    estado: Mapped[str] = mapped_column(String(20), default="ACTIVA", index=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha_imputacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    anulada_por_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True
    )
    fecha_anulacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_anulacion: Mapped[str | None] = mapped_column(String(250), nullable=True)


class MovimientoCaja(Base):
    __tablename__ = "movimientos_caja"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    apertura_caja_id: Mapped[UUID] = mapped_column(
        ForeignKey("aperturas_cajas.id", ondelete="RESTRICT"), index=True
    )
    tipo: Mapped[str] = mapped_column(String(10))
    medio: Mapped[str] = mapped_column(String(30), default="EFECTIVO")
    importe: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    concepto: Mapped[str] = mapped_column(String(200))
    categoria: Mapped[str] = mapped_column(String(30), default="MOVIMIENTO_MANUAL", index=True)
    proveedor_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    referencia: Mapped[str | None] = mapped_column(String(120), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="CONFIRMADO", index=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha_realizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class ArqueoCaja(Base):
    __tablename__ = "arqueos_caja"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    apertura_caja_id: Mapped[UUID] = mapped_column(
        ForeignKey("aperturas_cajas.id", ondelete="RESTRICT"), index=True
    )
    total_declarado: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class ArqueoCajaDetalle(Base):
    __tablename__ = "arqueos_caja_detalles"
    __table_args__ = (UniqueConstraint("arqueo_id", "denominacion", name="uq_arqueo_denominacion"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    arqueo_id: Mapped[UUID] = mapped_column(
        ForeignKey("arqueos_caja.id", ondelete="RESTRICT"), index=True
    )
    denominacion: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    cantidad: Mapped[int]
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2))


class CierreCaja(Base):
    __tablename__ = "cierres_caja"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    apertura_caja_id: Mapped[UUID] = mapped_column(
        ForeignKey("aperturas_cajas.id", ondelete="RESTRICT"), unique=True, index=True
    )
    total_ventas: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_cobros: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_pagos: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_ingresos: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_egresos: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    efectivo_esperado: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    efectivo_declarado: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    diferencia: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    cantidad_ventas: Mapped[int]
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class CierreCajaMedio(Base):
    __tablename__ = "cierres_caja_medios"
    __table_args__ = (UniqueConstraint("cierre_id", "medio", name="uq_cierre_medio"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cierre_id: Mapped[UUID] = mapped_column(
        ForeignKey("cierres_caja.id", ondelete="RESTRICT"), index=True
    )
    medio: Mapped[str] = mapped_column(String(30))
    esperado: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    declarado: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    diferencia: Mapped[Decimal] = mapped_column(Numeric(18, 2))
