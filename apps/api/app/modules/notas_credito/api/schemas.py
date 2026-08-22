from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class NotaCreditoLineaCrear(BaseModel):
    detalle_origen_id: UUID
    cantidad_base: Decimal = Field(gt=0, decimal_places=6)


class NotaCreditoCrear(BaseModel):
    tipo: Literal["CLIENTE", "PROVEEDOR"]
    documento_origen_id: UUID
    modalidad: Literal["PRODUCTOS", "NARRATIVA"] = "PRODUCTOS"
    lineas: list[NotaCreditoLineaCrear] = Field(default_factory=list)
    importe_narrativo: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    motivo: str = Field(min_length=5, max_length=250)
    afecta_stock: bool = True
    numero_externo: str | None = Field(default=None, max_length=80)
    apertura_caja_id: UUID | None = None
    medio_devolucion: Literal["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"] | None = None

    @model_validator(mode="after")
    def validar_lineas(self):
        ids = [x.detalle_origen_id for x in self.lineas]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un renglon del comprobante")
        if self.modalidad == "PRODUCTOS" and not self.lineas:
            raise ValueError("Debe indicar al menos un renglon para acreditar")
        if self.modalidad == "NARRATIVA":
            if self.tipo != "CLIENTE":
                raise ValueError("La nota narrativa esta disponible solamente para ventas")
            if self.lineas or self.importe_narrativo is None:
                raise ValueError("La nota narrativa requiere un importe y no admite renglones")
            self.afecta_stock = False
        if self.tipo == "PROVEEDOR" and not self.numero_externo:
            raise ValueError("Debe indicar el numero de nota de credito del proveedor")
        if bool(self.apertura_caja_id) != bool(self.medio_devolucion):
            raise ValueError("Para devolver dinero debe indicar la caja y el medio")
        if self.tipo != "CLIENTE" and self.apertura_caja_id:
            raise ValueError("La devolucion por caja corresponde solamente a clientes")
        return self


class NotaCreditoVista(BaseModel):
    id: UUID
    numero: int
    tipo: str
    socio_id: UUID
    socio_nombre: str
    documento_origen_id: UUID
    documento_origen: str
    almacen_id: UUID
    almacen_codigo: str
    numero_externo: str | None
    modalidad: str
    motivo: str
    afecta_stock: bool
    total_bruto: Decimal
    estado: str
    fecha_realizacion: datetime
    medio_devolucion: str | None
    importe_devolucion: Decimal
    lineas: list[dict]
