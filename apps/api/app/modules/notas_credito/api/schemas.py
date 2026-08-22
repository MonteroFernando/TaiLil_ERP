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
    lineas: list[NotaCreditoLineaCrear] = Field(min_length=1)
    motivo: str = Field(min_length=5, max_length=250)
    afecta_stock: bool = True
    numero_externo: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def validar_lineas(self):
        ids = [x.detalle_origen_id for x in self.lineas]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un renglon del comprobante")
        if self.tipo == "PROVEEDOR" and not self.numero_externo:
            raise ValueError("Debe indicar el numero de nota de credito del proveedor")
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
    motivo: str
    afecta_stock: bool
    total_bruto: Decimal
    estado: str
    fecha_realizacion: datetime
    lineas: list[dict]
