from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class UnidadMedida(Base):
    __tablename__ = "unidades_medida"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80))
    simbolo: Mapped[str] = mapped_column(String(20))
    admite_decimales: Mapped[bool] = mapped_column(Boolean, default=False)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class AlicuotaIva(Base):
    __tablename__ = "alicuotas_iva"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80))
    porcentaje: Mapped[Decimal] = mapped_column(Numeric(5, 2), unique=True)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class Articulo(Base):
    __tablename__ = "articulos"
    __table_args__ = (
        CheckConstraint(
            "tipo_articulo IN ('producto', 'servicio')",
            name="tipo_articulo_valido",
        ),
        CheckConstraint(
            "tipo_articulo = 'producto' OR (habilitado_inventario = false AND es_pesable = false)",
            name="servicio_sin_inventario",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    tipo_articulo: Mapped[str] = mapped_column(String(20), default="producto")
    descripcion: Mapped[str] = mapped_column(String(200), index=True)
    descripcion_ampliada: Mapped[str | None] = mapped_column(Text, nullable=True)
    habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    habilitado_venta: Mapped[bool] = mapped_column(Boolean, default=True)
    habilitado_compra: Mapped[bool] = mapped_column(Boolean, default=True)
    habilitado_inventario: Mapped[bool] = mapped_column(Boolean, default=True)
    es_pesable: Mapped[bool] = mapped_column(Boolean, default=False)
    unidad_base_id: Mapped[UUID] = mapped_column(ForeignKey("unidades_medida.id"))
    alicuota_iva_id: Mapped[UUID] = mapped_column(ForeignKey("alicuotas_iva.id"))
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ClasificadorArticulo(Base):
    __tablename__ = "clasificadores_articulos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tipo: Mapped[str] = mapped_column(String(30), index=True)
    nombre: Mapped[str] = mapped_column(String(120), index=True)
    padre_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("clasificadores_articulos.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class ArticuloClasificador(Base):
    __tablename__ = "articulos_clasificadores"

    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="CASCADE"), primary_key=True
    )
    clasificador_id: Mapped[UUID] = mapped_column(
        ForeignKey("clasificadores_articulos.id", ondelete="RESTRICT"), primary_key=True
    )


class Almacen(Base):
    __tablename__ = "almacenes"
    __table_args__ = (
        Index(
            "uq_almacenes_predeterminado",
            "es_predeterminado",
            unique=True,
            postgresql_where=text("es_predeterminado = true"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    descripcion: Mapped[str] = mapped_column(String(150))
    ubicacion: Mapped[str | None] = mapped_column(String(250), nullable=True)
    es_predeterminado: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class StockArticuloAlmacen(Base):
    __tablename__ = "stocks_articulos_almacenes"
    __table_args__ = (
        UniqueConstraint("articulo_id", "almacen_id", name="uq_stock_articulo_almacen"),
        CheckConstraint("cantidad_fisica >= 0", name="stock_fisico_no_negativo"),
        CheckConstraint("cantidad_pedida >= 0", name="stock_pedido_no_negativo"),
        CheckConstraint("cantidad_reservada >= 0", name="stock_reservado_no_negativo"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="CASCADE"), index=True
    )
    almacen_id: Mapped[UUID] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"), index=True
    )
    cantidad_fisica: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))
    cantidad_pedida: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))
    cantidad_reservada: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))


class MovimientoStock(Base):
    __tablename__ = "movimientos_stock"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    numero: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    tipo: Mapped[str] = mapped_column(String(30), index=True)
    estado: Mapped[str] = mapped_column(String(20), default="CONFIRMADO", index=True)
    almacen_origen_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    almacen_destino_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    documento_tipo: Mapped[str | None] = mapped_column(String(40), nullable=True)
    documento_numero: Mapped[str | None] = mapped_column(String(80), nullable=True)
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    movimiento_revertido_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("movimientos_stock.id", ondelete="RESTRICT"), nullable=True, unique=True
    )
    fecha_confirmacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class MovimientoStockDetalle(Base):
    __tablename__ = "movimientos_stock_detalles"
    __table_args__ = (CheckConstraint("cantidad_base <> 0", name="movimiento_cantidad_no_cero"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    movimiento_id: Mapped[UUID] = mapped_column(
        ForeignKey("movimientos_stock.id", ondelete="RESTRICT"), index=True
    )
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="RESTRICT"), index=True
    )
    almacen_id: Mapped[UUID] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"), index=True
    )
    cantidad_base: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    unidad_medida_id: Mapped[UUID] = mapped_column(
        ForeignKey("unidades_medida.id", ondelete="RESTRICT")
    )
    factor_conversion: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("1"))
    saldo_anterior: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    saldo_posterior: Mapped[Decimal] = mapped_column(Numeric(18, 6))


class InventarioStock(Base):
    __tablename__ = "inventarios_stock"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    numero: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    almacen_id: Mapped[UUID] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"), index=True
    )
    estado: Mapped[str] = mapped_column(String(20), default="PENDIENTE", index=True)
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_creacion_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT")
    )
    usuario_finalizacion_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True
    )
    movimiento_ajuste_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("movimientos_stock.id", ondelete="RESTRICT"), nullable=True, unique=True
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    fecha_finalizacion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True
    )


class InventarioStockDetalle(Base):
    __tablename__ = "inventarios_stock_detalles"
    __table_args__ = (
        UniqueConstraint("inventario_id", "articulo_id", name="uq_inventario_articulo"),
        CheckConstraint("cantidad_esperada >= 0", name="inventario_esperada_no_negativa"),
        CheckConstraint(
            "cantidad_contada IS NULL OR cantidad_contada >= 0",
            name="inventario_contada_no_negativa",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    inventario_id: Mapped[UUID] = mapped_column(
        ForeignKey("inventarios_stock.id", ondelete="RESTRICT"), index=True
    )
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="RESTRICT"), index=True
    )
    cantidad_esperada: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    cantidad_contada: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)


class ListaPrecio(Base):
    __tablename__ = "listas_precios"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    es_base: Mapped[bool] = mapped_column(Boolean, default=False)
    porcentaje_incremento: Mapped[Decimal] = mapped_column(Numeric(9, 4), default=Decimal("0"))
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PrecioArticuloBase(Base):
    __tablename__ = "precios_articulos_base"

    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="RESTRICT"), primary_key=True
    )
    precio_bruto: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PrecioArticuloLista(Base):
    __tablename__ = "precios_articulos_listas"
    __table_args__ = (
        UniqueConstraint("lista_precio_id", "articulo_id", name="uq_precio_lista_articulo"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    lista_precio_id: Mapped[UUID] = mapped_column(
        ForeignKey("listas_precios.id", ondelete="RESTRICT"), index=True
    )
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="RESTRICT"), index=True
    )
    modo: Mapped[str] = mapped_column(String(20))
    porcentaje_incremento: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    precio_manual: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ReglaListaPrecioArticulo(Base):
    __tablename__ = "reglas_listas_precios_articulos"
    __table_args__ = (
        UniqueConstraint("articulo_id", "lista_precio_id", name="uq_regla_articulo_lista"),
        CheckConstraint("cantidad_minima > 0", name="regla_lista_cantidad_positiva"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="RESTRICT"), index=True
    )
    lista_precio_id: Mapped[UUID] = mapped_column(
        ForeignKey("listas_precios.id", ondelete="RESTRICT"), index=True
    )
    cantidad_minima: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class VentaDocumento(Base):
    __tablename__ = "ventas_documentos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    numero: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    cliente_id: Mapped[UUID] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), index=True
    )
    almacen_id: Mapped[UUID] = mapped_column(ForeignKey("almacenes.id", ondelete="RESTRICT"))
    estado: Mapped[str] = mapped_column(String(20), default="CONFIRMADO", index=True)
    subtotal_neto: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_iva: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_bruto: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    saldo_pendiente: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    movimiento_stock_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("movimientos_stock.id", ondelete="RESTRICT"), nullable=True, unique=True
    )
    fecha_realizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class VentaDocumentoDetalle(Base):
    __tablename__ = "ventas_documentos_detalles"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    venta_id: Mapped[UUID] = mapped_column(
        ForeignKey("ventas_documentos.id", ondelete="RESTRICT"), index=True
    )
    articulo_id: Mapped[UUID] = mapped_column(ForeignKey("articulos.id", ondelete="RESTRICT"))
    lista_precio_id: Mapped[UUID] = mapped_column(
        ForeignKey("listas_precios.id", ondelete="RESTRICT")
    )
    cantidad_base: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    precio_unitario_bruto: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    porcentaje_iva: Mapped[Decimal] = mapped_column(Numeric(9, 4))
    subtotal_neto: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    importe_iva: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    total_bruto: Mapped[Decimal] = mapped_column(Numeric(18, 2))


class CobroDocumento(Base):
    __tablename__ = "cobros_documentos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    numero: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    cliente_id: Mapped[UUID] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), index=True
    )
    estado: Mapped[str] = mapped_column(String(20), default="CONFIRMADO", index=True)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha_realizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class CobroMedioPago(Base):
    __tablename__ = "cobros_medios_pago"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cobro_id: Mapped[UUID] = mapped_column(
        ForeignKey("cobros_documentos.id", ondelete="RESTRICT"), index=True
    )
    medio: Mapped[str] = mapped_column(String(30))
    importe: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    referencia: Mapped[str | None] = mapped_column(String(120), nullable=True)


class ImputacionCobroVenta(Base):
    __tablename__ = "imputaciones_cobros_ventas"
    __table_args__ = (UniqueConstraint("cobro_id", "venta_id", name="uq_imputacion_cobro_venta"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cobro_id: Mapped[UUID] = mapped_column(
        ForeignKey("cobros_documentos.id", ondelete="RESTRICT"), index=True
    )
    venta_id: Mapped[UUID] = mapped_column(
        ForeignKey("ventas_documentos.id", ondelete="RESTRICT"), index=True
    )
    importe: Mapped[Decimal] = mapped_column(Numeric(18, 2))


class ArticuloUnidad(Base):
    __tablename__ = "articulos_unidades"
    __table_args__ = (
        CheckConstraint("factor_a_base > 0", name="factor_a_base_positivo"),
        Index(
            "uq_articulos_unidades_alternativa",
            "articulo_id",
            unique=True,
            postgresql_where=text("es_unidad_alternativa = true"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="CASCADE"), index=True
    )
    unidad_medida_id: Mapped[UUID] = mapped_column(ForeignKey("unidades_medida.id"))
    nombre_presentacion: Mapped[str] = mapped_column(String(100))
    factor_a_base: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    es_unidad_base: Mapped[bool] = mapped_column(Boolean, default=False)
    es_unidad_alternativa: Mapped[bool] = mapped_column(Boolean, default=False)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class CodigoBarraArticulo(Base):
    __tablename__ = "articulos_codigos_barra"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="cantidad_positiva"),
        CheckConstraint(
            "(modo_contenido = 'cantidad' AND articulo_unidad_id IS NULL) OR "
            "(modo_contenido = 'unidad' AND articulo_unidad_id IS NOT NULL)",
            name="modo_contenido_valido",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="CASCADE"), index=True
    )
    codigo: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    modo_contenido: Mapped[str] = mapped_column(String(20), default="cantidad")
    cantidad: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("1"))
    articulo_unidad_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("articulos_unidades.id", ondelete="RESTRICT"), nullable=True
    )
    principal: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Socio(Base):
    __tablename__ = "socios"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cuenta_padre_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    cuenta_padre_cliente_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    cuenta_padre_proveedor_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("socios.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    razon_social: Mapped[str] = mapped_column(String(200), index=True)
    nombre_fantasia: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tipo_persona: Mapped[str] = mapped_column(String(10), default="juridica")
    tipo_documento: Mapped[str] = mapped_column(String(20), default="CUIT")
    numero_documento: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    condicion_iva_codigo: Mapped[int] = mapped_column(default=1)
    condicion_iibb: Mapped[str | None] = mapped_column(String(30), nullable=True)
    numero_iibb: Mapped[str | None] = mapped_column(String(30), nullable=True)
    actividad_arca_codigo: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actividad_arca_descripcion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    es_proveedor: Mapped[bool] = mapped_column(Boolean, default=False)
    es_cliente: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class DomicilioSocio(Base):
    __tablename__ = "socios_domicilios"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tercero_id: Mapped[UUID] = mapped_column(
        "socio_id", ForeignKey("socios.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[str] = mapped_column(String(30), default="comercial")
    rol: Mapped[str] = mapped_column(String(20), index=True)
    calle: Mapped[str] = mapped_column(String(150))
    numero: Mapped[str] = mapped_column(String(20))
    localidad: Mapped[str] = mapped_column(String(100))
    provincia: Mapped[str] = mapped_column(String(100))
    pais: Mapped[str] = mapped_column(String(100), default="ARGENTINA")
    codigo_postal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contacto: Mapped[str | None] = mapped_column(String(150), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    es_principal: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class CuentaCorrienteVenta(Base):
    __tablename__ = "cuentas_corrientes_ventas"
    __table_args__ = (
        CheckConstraint("limite_deuda >= 0", name="limite_deuda_no_negativo"),
        CheckConstraint("limite_periodo >= 0", name="limite_periodo_no_negativo"),
        CheckConstraint("limite_periodo <= limite_deuda", name="limite_periodo_valido"),
        CheckConstraint("dias_maximos_deuda >= 0", name="dias_deuda_no_negativos"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    socio_id: Mapped[UUID] = mapped_column(
        ForeignKey("socios.id", ondelete="CASCADE"), unique=True, index=True
    )
    activa: Mapped[bool] = mapped_column(Boolean, default=False)
    limite_deuda: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    limite_periodo: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    temporalidad: Mapped[str] = mapped_column(String(20), default="mensual")
    dias_maximos_deuda: Mapped[int] = mapped_column(default=0)


class ArticuloProveedor(Base):
    __tablename__ = "articulos_proveedores"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    articulo_id: Mapped[UUID] = mapped_column(
        ForeignKey("articulos.id", ondelete="CASCADE"), index=True
    )
    proveedor_id: Mapped[UUID] = mapped_column(ForeignKey("socios.id"), index=True)
    codigo_proveedor: Mapped[str] = mapped_column(String(100))
    principal: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


# Alias transitorios para mantener compatibles los casos de uso existentes.
Tercero = Socio
DomicilioTercero = DomicilioSocio
