from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class UnidadMedidaVista(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    simbolo: str
    admite_decimales: bool


class AlicuotaIvaVista(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    porcentaje: Decimal


class ArticuloIvaActualizar(BaseModel):
    alicuota_iva_id: UUID


class SocioCrear(BaseModel):
    cuenta_padre_id: UUID | None = None
    codigo: str = Field(min_length=1, max_length=20)
    razon_social: str = Field(min_length=2, max_length=200)
    nombre_fantasia: str | None = Field(default=None, max_length=200)
    tipo_persona: Literal["fisica", "juridica"] = "juridica"
    tipo_documento: Literal["CUIT", "CUIL", "DNI", "CDI", "PASAPORTE"] = "CUIT"
    numero_documento: str = Field(min_length=6, max_length=20)
    condicion_iva_codigo: Literal[1, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16]
    condicion_iibb: str | None = Field(default=None, max_length=30)
    numero_iibb: str | None = Field(default=None, max_length=30)
    actividad_arca_codigo: str | None = Field(default=None, max_length=20)
    actividad_arca_descripcion: str | None = Field(default=None, max_length=200)


class SocioVista(SocioCrear):
    id: UUID
    es_proveedor: bool
    es_cliente: bool
    cuenta_padre_cliente_id: UUID | None = None
    cuenta_padre_proveedor_id: UUID | None = None
    activo: bool


class SocioActualizar(SocioCrear):
    activo: bool = True


class SocioNegocioCrear(SocioCrear):
    es_cliente: bool = True
    es_proveedor: bool = False

    @model_validator(mode="after")
    def validar_roles(self):
        if not self.es_cliente and not self.es_proveedor:
            raise ValueError("El socio debe ser cliente, proveedor o ambos")
        return self


class SocioNegocioActualizar(SocioNegocioCrear):
    activo: bool = True


class ClienteCrear(SocioCrear):
    tipo_persona: Literal["fisica", "juridica"] = "fisica"
    tipo_documento: Literal["CUIT", "CUIL", "DNI", "CDI", "PASAPORTE"] = "DNI"
    condicion_iva_codigo: Literal[1, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16] = 5


class CuentaPadreSocioActualizar(BaseModel):
    rol: Literal["cliente", "proveedor"]
    cuenta_padre_id: UUID | None = None


class DomicilioSocioCrear(BaseModel):
    rol: Literal["cliente", "proveedor"]
    tipo: Literal["legal", "fiscal", "comercial", "entrega", "otro"] = "comercial"
    calle: str = Field(min_length=1, max_length=150)
    numero: str = Field(min_length=1, max_length=20)
    localidad: str = Field(min_length=1, max_length=100)
    provincia: str = Field(min_length=1, max_length=100)
    pais: str = Field(default="ARGENTINA", min_length=2, max_length=100)
    codigo_postal: str | None = Field(default=None, max_length=20)
    contacto: str | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=200)
    es_principal: bool = False


class DomicilioSocioVista(DomicilioSocioCrear):
    id: UUID
    tercero_id: UUID
    activo: bool


class DomicilioSocioActualizar(DomicilioSocioCrear):
    activo: bool = True


class CuentaCorrienteVentasConfigurar(BaseModel):
    activa: bool = False
    limite_deuda: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    limite_periodo: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    temporalidad: Literal["diaria", "semanal", "mensual"] = "mensual"
    dias_maximos_deuda: int = Field(default=0, ge=0, le=3650)

    @model_validator(mode="after")
    def validar_limites(self):
        if self.limite_periodo > self.limite_deuda:
            raise ValueError("El limite por periodo no puede superar el limite total de deuda")
        if self.activa and self.limite_deuda <= 0:
            raise ValueError("Una cuenta activa requiere un limite de deuda mayor que cero")
        return self


class CuentaCorrienteVentasVista(CuentaCorrienteVentasConfigurar):
    socio_id: UUID
    deuda_actual: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    consumo_periodo: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    credito_disponible: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    saldo_favor: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    disponible_total: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    deuda_vencida: bool = False


class SocioNegocioAltaCompleta(SocioNegocioCrear):
    domicilios: list[DomicilioSocioCrear] = Field(default_factory=list)
    cuenta_padre_cliente_id: UUID | None = None
    cuenta_padre_proveedor_id: UUID | None = None
    cuenta_corriente_ventas: CuentaCorrienteVentasConfigurar | None = None


# Nombres compatibles con la API existente de proveedores.
ProveedorCrear = SocioCrear
ProveedorVista = SocioVista
ProveedorActualizar = SocioActualizar
TerceroCrear = SocioCrear
TerceroVista = SocioVista
TerceroActualizar = SocioActualizar
DomicilioTerceroCrear = DomicilioSocioCrear
DomicilioTerceroVista = DomicilioSocioVista
DomicilioTerceroActualizar = DomicilioSocioActualizar


class StockInicialArticuloCrear(BaseModel):
    almacen_id: UUID
    cantidad: Decimal = Field(ge=0, max_digits=18, decimal_places=6)


class ArticuloCrear(BaseModel):
    tipo_articulo: Literal["producto", "servicio"] = "producto"
    codigo_alternativo: str | None = Field(default=None, min_length=2, max_length=20)
    descripcion: str = Field(min_length=2, max_length=200)
    descripcion_ampliada: str | None = None
    unidad_base_id: UUID
    alicuota_iva_id: UUID
    habilitado: bool = True
    habilitado_venta: bool = True
    habilitado_compra: bool = True
    habilitado_inventario: bool = True
    es_pesable: bool = False
    clasificador_ids: list[UUID] = Field(default_factory=list)
    stock_inicial: list[StockInicialArticuloCrear] = Field(default_factory=list)

    @model_validator(mode="after")
    def validar_tipo_articulo(self):
        almacenes = [linea.almacen_id for linea in self.stock_inicial]
        if len(almacenes) != len(set(almacenes)):
            raise ValueError("El stock inicial no puede repetir un almacen")
        if self.stock_inicial and not self.habilitado_inventario:
            raise ValueError("El stock inicial requiere un producto habilitado para inventario")
        if self.tipo_articulo == "producto" and self.codigo_alternativo:
            raise ValueError("Los productos reciben un codigo numerico automatico")
        if self.tipo_articulo == "servicio":
            codigo = (self.codigo_alternativo or "").strip()
            if not codigo or not any(caracter.isalpha() for caracter in codigo):
                raise ValueError("Un servicio requiere un codigo con al menos una letra")
            if not codigo.replace("-", "").replace("_", "").isalnum():
                raise ValueError("El codigo solo admite letras, numeros, guion y guion bajo")
            if self.habilitado_inventario or self.es_pesable:
                raise ValueError("Un servicio no puede controlar inventario ni ser pesable")
        return self


class ArticuloActualizar(ArticuloCrear):
    pass


class ArticuloUnidadCrear(BaseModel):
    unidad_medida_id: UUID
    nombre_presentacion: str = Field(min_length=2, max_length=100)
    factor_a_base: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    es_unidad_alternativa: bool = False


class ArticuloUnidadVista(ArticuloUnidadCrear):
    id: UUID
    es_unidad_base: bool
    activa: bool


class ArticuloUnidadActualizar(ArticuloUnidadCrear):
    activa: bool = True


class CodigoBarraCrear(BaseModel):
    codigo: str = Field(min_length=3, max_length=80)
    modo_contenido: Literal["cantidad", "unidad"] = "cantidad"
    cantidad: Decimal = Field(default=Decimal("1"), gt=0, max_digits=18, decimal_places=6)
    articulo_unidad_id: UUID | None = None
    principal: bool = False

    @model_validator(mode="after")
    def validar_modo(self):
        if self.modo_contenido == "unidad" and self.articulo_unidad_id is None:
            raise ValueError("El modo unidad requiere una presentacion")
        if self.modo_contenido == "cantidad" and self.articulo_unidad_id is not None:
            raise ValueError("El modo cantidad no admite una presentacion")
        return self


class CodigoBarraVista(CodigoBarraCrear):
    id: UUID
    activo: bool
    cantidad_base_resuelta: Decimal


class CodigoBarraActualizar(CodigoBarraCrear):
    activo: bool = True


class ArticuloProveedorCrear(BaseModel):
    proveedor_id: UUID
    codigo_proveedor: str = Field(min_length=1, max_length=100)
    principal: bool = False


class ArticuloProveedorVista(ArticuloProveedorCrear):
    id: UUID
    razon_social: str
    activo: bool


class ArticuloProveedorActualizar(ArticuloProveedorCrear):
    activo: bool = True


class ArticuloResumen(BaseModel):
    id: UUID
    codigo: str
    tipo_articulo: str
    descripcion: str
    habilitado: bool
    habilitado_venta: bool
    habilitado_compra: bool
    habilitado_inventario: bool
    es_pesable: bool
    unidad_base: UnidadMedidaVista
    alicuota_iva: AlicuotaIvaVista
    clasificador_ids: list[UUID] = Field(default_factory=list)


class ClasificadorCrear(BaseModel):
    tipo: str = Field(min_length=2, max_length=30)
    nombre: str = Field(min_length=2, max_length=120)
    padre_id: UUID | None = None


class ClasificadorVista(ClasificadorCrear):
    id: UUID
    activo: bool


class ClasificadorActualizar(ClasificadorCrear):
    activo: bool = True


class AlmacenCrear(BaseModel):
    codigo: str = Field(min_length=1, max_length=30)
    descripcion: str = Field(min_length=2, max_length=150)
    ubicacion: str | None = Field(default=None, max_length=250)


class AlmacenVista(AlmacenCrear):
    id: UUID
    es_predeterminado: bool
    activo: bool


class AlmacenActualizar(AlmacenCrear):
    es_predeterminado: bool = False
    activo: bool = True


class StockArticuloVista(BaseModel):
    almacen_id: UUID
    almacen_codigo: str
    almacen_descripcion: str
    cantidad_fisica: Decimal
    cantidad_pedida: Decimal
    cantidad_reservada: Decimal
    cantidad_disponible: Decimal
    cantidad_disponible_futura: Decimal


class MovimientoStockLineaCrear(BaseModel):
    articulo_id: UUID
    cantidad: Decimal = Field(decimal_places=6)


class AjusteStockCrear(BaseModel):
    almacen_id: UUID
    observacion: str = Field(min_length=3, max_length=500)
    detalles: list[MovimientoStockLineaCrear] = Field(min_length=1)

    @model_validator(mode="after")
    def cantidades_no_nulas(self) -> "AjusteStockCrear":
        if any(linea.cantidad == 0 for linea in self.detalles):
            raise ValueError("Las cantidades del ajuste no pueden ser cero")
        return self


class TransferenciaStockCrear(BaseModel):
    almacen_origen_id: UUID
    almacen_destino_id: UUID
    observacion: str | None = Field(default=None, max_length=500)
    detalles: list[MovimientoStockLineaCrear] = Field(min_length=1)

    @model_validator(mode="after")
    def transferencia_valida(self) -> "TransferenciaStockCrear":
        if self.almacen_origen_id == self.almacen_destino_id:
            raise ValueError("Los almacenes deben ser diferentes")
        if any(linea.cantidad <= 0 for linea in self.detalles):
            raise ValueError("Las cantidades transferidas deben ser positivas")
        return self


class MovimientoStockDetalleVista(BaseModel):
    id: UUID
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    almacen_id: UUID
    almacen_codigo: str
    cantidad_base: Decimal
    saldo_anterior: Decimal
    saldo_posterior: Decimal


class MovimientoStockVista(BaseModel):
    id: UUID
    numero: int
    tipo: str
    estado: str
    almacen_origen_id: UUID | None
    almacen_destino_id: UUID | None
    observacion: str | None
    usuario_nombre: str
    movimiento_revertido_id: UUID | None
    fecha_confirmacion: datetime
    detalles: list[MovimientoStockDetalleVista]


class ExistenciaStockVista(StockArticuloVista):
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str


class InventarioStockCrear(BaseModel):
    almacen_id: UUID
    articulo_ids: list[UUID] = Field(min_length=1)
    observacion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def articulos_sin_repetir(self) -> "InventarioStockCrear":
        if len(self.articulo_ids) != len(set(self.articulo_ids)):
            raise ValueError("No se puede repetir un articulo")
        return self


class InventarioConteoLinea(BaseModel):
    detalle_id: UUID
    cantidad_contada: Decimal = Field(ge=0, decimal_places=6)
    observacion: str | None = Field(default=None, max_length=500)


class InventarioConteoGuardar(BaseModel):
    detalles: list[InventarioConteoLinea] = Field(min_length=1)


class InventarioStockDetalleVista(BaseModel):
    id: UUID
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    cantidad_esperada: Decimal
    cantidad_contada: Decimal | None
    diferencia: Decimal | None
    observacion: str | None


class InventarioStockVista(BaseModel):
    id: UUID
    numero: int
    almacen_id: UUID
    almacen_codigo: str
    almacen_descripcion: str
    estado: str
    observacion: str | None
    usuario_creacion: str
    usuario_finalizacion: str | None
    movimiento_ajuste_id: UUID | None
    fecha_creacion: datetime
    fecha_finalizacion: datetime | None
    fecha_modificacion: datetime
    detalles: list[InventarioStockDetalleVista]


class ListaPrecioCrear(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    porcentaje_incremento: Decimal = Field(default=0, ge=-100, decimal_places=4)


class ListaPrecioActualizar(ListaPrecioCrear):
    activa: bool = True


class ListaPrecioVista(BaseModel):
    id: UUID
    nombre: str
    es_base: bool
    porcentaje_incremento: Decimal
    activa: bool
    fecha_creacion: datetime


class PrecioBaseActualizar(BaseModel):
    precio_bruto: Decimal = Field(ge=0, decimal_places=6)


class PrecioBaseMasivoActualizar(BaseModel):
    articulo_id: UUID | None = None
    clasificador_id: UUID | None = None
    modo: Literal["FIJAR", "PORCENTAJE"]
    valor: Decimal = Field(decimal_places=6)

    @model_validator(mode="after")
    def validar_actualizacion(self):
        if (self.articulo_id is None) == (self.clasificador_id is None):
            raise ValueError("Debe indicar un articulo o un clasificador")
        if self.clasificador_id and self.modo == "FIJAR":
            raise ValueError("Un grupo solo admite incremento o disminucion porcentual")
        if self.modo == "FIJAR" and self.valor < 0:
            raise ValueError("El precio fijo no puede ser negativo")
        if self.modo == "PORCENTAJE" and self.valor < -100:
            raise ValueError("La disminucion no puede superar el 100 por ciento")
        return self


class PrecioBaseMasivoResultado(BaseModel):
    articulos_actualizados: int


class PrecioListaArticuloActualizar(BaseModel):
    modo: Literal["PORCENTAJE", "MANUAL"]
    porcentaje_incremento: Decimal | None = Field(default=None, ge=-100, decimal_places=4)
    precio_manual: Decimal | None = Field(default=None, ge=0, decimal_places=6)

    @model_validator(mode="after")
    def valor_requerido(self) -> "PrecioListaArticuloActualizar":
        if self.modo == "PORCENTAJE" and self.porcentaje_incremento is None:
            raise ValueError("Debe indicar el porcentaje")
        if self.modo == "MANUAL" and self.precio_manual is None:
            raise ValueError("Debe indicar el precio manual")
        return self


class PrecioArticuloListaVista(BaseModel):
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    precio_base_bruto: Decimal
    modo: str
    porcentaje_aplicado: Decimal
    precio_venta_bruto: Decimal
    margen_porcentual: Decimal


class PrecioVentaConsultaVista(BaseModel):
    lista_id: UUID
    lista_nombre: str
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    precio_venta_bruto: Decimal
    precio_anterior_bruto: Decimal | None = None


class ReglaListaPrecioCrear(BaseModel):
    lista_precio_id: UUID
    cantidad_minima: Decimal = Field(gt=0, decimal_places=6)


class ReglaListaPrecioVista(ReglaListaPrecioCrear):
    id: UUID
    lista_nombre: str
    activa: bool


class PosVentaLineaCrear(BaseModel):
    articulo_id: UUID
    cantidad_base: Decimal = Field(gt=0, decimal_places=6)


class PosMedioPagoCrear(BaseModel):
    medio: Literal[
        "EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO", "CUENTA_CORRIENTE"
    ]
    importe: Decimal = Field(gt=0, decimal_places=2)
    referencia: str | None = Field(default=None, max_length=120)


class PosVentaCrear(BaseModel):
    cliente_id: UUID | None = None
    almacen_id: UUID
    lineas: list[PosVentaLineaCrear] = Field(min_length=1)
    pagos: list[PosMedioPagoCrear] = Field(default_factory=list)
    destino_excedente: Literal["VUELTO", "SALDO_FAVOR"] | None = None
    borrador_id: UUID | None = None
    apertura_caja_id: UUID | None = None

    @model_validator(mode="after")
    def validar_cuenta_corriente_unica(self) -> "PosVentaCrear":
        cuentas_corrientes = sum(
            pago.medio == "CUENTA_CORRIENTE" for pago in self.pagos
        )
        if cuentas_corrientes > 1:
            raise ValueError("Solo se permite una imputacion a CUENTA CORRIENTE")
        if self.destino_excedente == "SALDO_FAVOR" and self.cliente_id is None:
            raise ValueError("Para dejar saldo a favor debe seleccionar un cliente")
        return self


class PuntoVentaCrear(BaseModel):
    codigo: str = Field(min_length=1, max_length=4)
    descripcion: str = Field(min_length=2, max_length=120)
    almacen_id: UUID


class DescripcionPosActualizar(BaseModel):
    descripcion: str = Field(min_length=2, max_length=120)


class PuntoVentaVista(PuntoVentaCrear):
    id: UUID
    letra: str
    tipo_documento: str
    ultimo_numero: int
    activo: bool


class CajaVentaCrear(BaseModel):
    punto_venta_id: UUID
    codigo: str = Field(min_length=1, max_length=20)
    descripcion: str = Field(min_length=2, max_length=120)


class CajaVentaVista(CajaVentaCrear):
    id: UUID
    activo: bool


class AperturaCajaCrear(BaseModel):
    caja_id: UUID
    efectivo_inicial: Decimal = Field(ge=0, decimal_places=2)
    periodo_operativo: date | None = None


class AperturaCajaVista(BaseModel):
    id: UUID
    caja_id: UUID
    caja_codigo: str
    caja_descripcion: str
    punto_venta_id: UUID
    punto_venta_codigo: str
    usuario_id: UUID
    usuario_nombre: str
    efectivo_inicial: Decimal
    periodo_operativo: date
    estado: str
    fecha_apertura: datetime
    fecha_cierre: datetime | None


class PosVentaLineaVista(BaseModel):
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    es_pesable: bool
    lista_nombre: str
    cantidad_base: Decimal
    precio_unitario_bruto: Decimal
    precio_anterior_bruto: Decimal | None = None
    descuento_porcentual: Decimal = Decimal("0")
    porcentaje_iva: Decimal
    subtotal_neto: Decimal
    importe_iva: Decimal
    total_bruto: Decimal


class PosVentaVista(BaseModel):
    id: UUID
    numero: int | None
    numero_completo: str | None = None
    letra: str = "T"
    tipo_documento: str = "PRESUPUESTO"
    punto_venta_codigo: str | None = None
    caja_codigo: str | None = None
    cliente_id: UUID
    cliente_nombre: str
    almacen_id: UUID
    estado: str
    subtotal_neto: Decimal
    total_iva: Decimal
    total_bruto: Decimal
    saldo_pendiente: Decimal
    vuelto: Decimal = Decimal("0.00")
    saldo_favor_generado: Decimal = Decimal("0.00")
    cobro_id: UUID | None
    cobro_numero: int | None
    fecha_realizacion: datetime
    lineas: list[PosVentaLineaVista]


class ArticuloDetalle(ArticuloResumen):
    descripcion_ampliada: str | None
    unidades: list[ArticuloUnidadVista]
    codigos_barra: list[CodigoBarraVista]
    proveedores: list[ArticuloProveedorVista]
    stocks: list[StockArticuloVista]


class CompraLineaCantidad(BaseModel):
    articulo_id: UUID
    cantidad_base: Decimal = Field(gt=0, decimal_places=6)


class IngresoMercaderiaCrear(BaseModel):
    proveedor_id: UUID
    almacen_id: UUID
    observacion: str | None = Field(default=None, max_length=500)
    lineas: list[CompraLineaCantidad] = Field(min_length=1)


class FacturaCompraLineaCrear(CompraLineaCantidad):
    costo_bruto_unitario: Decimal = Field(ge=0, decimal_places=6)
    politica_costo: Literal["REEMPLAZAR", "PROMEDIO", "NO_MODIFICAR"] | None = None


class FacturaCompraCrear(BaseModel):
    proveedor_id: UUID
    almacen_id: UUID
    letra: str = Field(min_length=1, max_length=1, pattern=r"^[A-Za-z]$")
    punto_emision: str = Field(min_length=1, max_length=5, pattern=r"^\d{1,5}$")
    numero_factura: str = Field(min_length=1, max_length=20, pattern=r"^\d{1,20}$")
    ingreso_id: UUID | None = None
    politica_costo: Literal["REEMPLAZAR", "PROMEDIO", "NO_MODIFICAR"]
    lineas: list[FacturaCompraLineaCrear] = Field(min_length=1)

    @field_validator("letra")
    @classmethod
    def normalizar_letra(cls, valor: str) -> str:
        return valor.upper()

    @field_validator("punto_emision")
    @classmethod
    def normalizar_punto_emision(cls, valor: str) -> str:
        return valor.zfill(5)

    @field_validator("numero_factura")
    @classmethod
    def normalizar_numero_factura(cls, valor: str) -> str:
        return valor.zfill(8)


class CompraLineaVista(BaseModel):
    id: UUID
    articulo_id: UUID
    articulo_codigo: str
    articulo_descripcion: str
    cantidad_base: Decimal
    costo_bruto_unitario: Decimal | None = None
    costo_anterior: Decimal | None = None
    costo_resultante: Decimal | None = None
    politica_costo: str | None = None
    advertencia: str | None = None
    total_bruto: Decimal | None = None


class DocumentoCompraVista(BaseModel):
    id: UUID
    numero: int
    tipo: Literal["INGRESO", "FACTURA"]
    proveedor_id: UUID
    proveedor_nombre: str
    almacen_id: UUID
    almacen_codigo: str
    estado: str
    fecha_realizacion: datetime
    numero_proveedor: str | None = None
    letra: str | None = None
    punto_emision: str | None = None
    numero_factura: str | None = None
    comprobante_proveedor: str | None = None
    ingreso_id: UUID | None = None
    politica_costo: str | None = None
    total_bruto: Decimal | None = None
    lineas: list[CompraLineaVista]


class RotacionCompraArticuloVista(BaseModel):
    articulo_id: UUID
    codigo: str
    descripcion: str
    es_pesable: bool
    dias_con_stock: int
    cantidad_vendida: Decimal
    promedio_diario: Decimal
    disponible: Decimal
    cantidad_pedida: Decimal
    necesidad_proyectada: Decimal
    sugerencia_compra: Decimal


class RotacionComprasVista(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    dias_analisis: int
    dias_proyeccion: int
    dias_trabajados: int
    almacen_id: UUID | None
    articulos: list[RotacionCompraArticuloVista]
