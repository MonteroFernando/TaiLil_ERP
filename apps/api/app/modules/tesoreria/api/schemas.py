from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class MedioPagoCrear(BaseModel):
    medio: str = Field(min_length=1, max_length=30)
    importe: Decimal = Field(gt=0, decimal_places=2)
    referencia: str | None = Field(default=None, max_length=120)


class ImputacionCrear(BaseModel):
    documento_id: UUID
    importe: Decimal = Field(gt=0, decimal_places=2)


class DocumentoTesoreriaCrear(BaseModel):
    socio_id: UUID
    apertura_caja_id: UUID | None = None
    medios: list[MedioPagoCrear] = Field(min_length=1)
    imputaciones: list[ImputacionCrear] = Field(default_factory=list)
    observacion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validar_importes(self):
        ids = [item.documento_id for item in self.imputaciones]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede imputar dos veces el mismo documento")
        total = sum((item.importe for item in self.medios), Decimal("0"))
        imputado = sum((item.importe for item in self.imputaciones), Decimal("0"))
        if imputado > total:
            raise ValueError("El total imputado no puede superar al documento de pago")
        return self


class ConciliacionAgregar(BaseModel):
    documento_pago_id: UUID
    imputaciones: list[ImputacionCrear] = Field(min_length=1)


class AnulacionConciliacion(BaseModel):
    motivo: str = Field(min_length=5, max_length=250)


class MovimientoCajaCrear(BaseModel):
    apertura_caja_id: UUID
    tipo: str = Field(pattern="^(INGRESO|EGRESO)$")
    medio: str = Field(default="EFECTIVO", min_length=1, max_length=30)
    importe: Decimal = Field(gt=0, decimal_places=2)
    concepto: str = Field(min_length=3, max_length=200)


class DenominacionArqueoCrear(BaseModel):
    denominacion: Decimal = Field(gt=0, decimal_places=2)
    cantidad: int = Field(ge=0)


class ArqueoCrear(BaseModel):
    apertura_caja_id: UUID
    denominaciones: list[DenominacionArqueoCrear] = Field(min_length=1)
    observacion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def denominaciones_unicas(self):
        valores = [item.denominacion for item in self.denominaciones]
        if len(valores) != len(set(valores)):
            raise ValueError("Las denominaciones no pueden repetirse")
        return self


class DeclaracionMedioCrear(BaseModel):
    medio: str = Field(min_length=1, max_length=30)
    declarado: Decimal = Field(ge=0, decimal_places=2)


class CierreCajaCrear(BaseModel):
    medios: list[DeclaracionMedioCrear] = Field(min_length=1)
    observacion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def medios_unicos(self):
        medios = [item.medio.upper() for item in self.medios]
        if len(medios) != len(set(medios)):
            raise ValueError("Los medios declarados no pueden repetirse")
        if "EFECTIVO" not in medios:
            raise ValueError("El cierre debe declarar el efectivo contado")
        return self


class DocumentoTesoreriaVista(BaseModel):
    id: UUID
    numero: int
    socio_id: UUID
    socio_nombre: str
    estado: str
    total: Decimal
    disponible: Decimal
    fecha_realizacion: datetime
    medios: list[dict]
    imputaciones: list[dict]


class CuentaCorrienteClienteResumen(BaseModel):
    socio_id: UUID
    codigo: str
    razon_social: str
    numero_documento: str
    cuenta_configurada: bool
    cuenta_activa: bool
    deuda_actual: Decimal
    saldo_favor: Decimal
    documentos_pendientes: int
    deuda_mas_antigua: datetime | None


class CuentaCorrienteProveedorResumen(BaseModel):
    socio_id: UUID
    codigo: str
    razon_social: str
    numero_documento: str
    deuda_actual: Decimal
    saldo_favor: Decimal
    documentos_pendientes: int
    deuda_mas_antigua: datetime | None
