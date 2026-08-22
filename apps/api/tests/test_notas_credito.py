from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.notas_credito.api.schemas import NotaCreditoCrear


def test_nota_cliente_admite_devolucion_parcial() -> None:
    datos = NotaCreditoCrear(
        tipo="CLIENTE",
        documento_origen_id=uuid4(),
        motivo="DEVOLUCION PARCIAL",
        afecta_stock=True,
        lineas=[{"detalle_origen_id": uuid4(), "cantidad_base": "2.500000"}],
    )
    assert datos.lineas[0].cantidad_base == Decimal("2.500000")


def test_nota_proveedor_exige_numero_externo() -> None:
    with pytest.raises(ValidationError):
        NotaCreditoCrear(
            tipo="PROVEEDOR",
            documento_origen_id=uuid4(),
            motivo="DIFERENCIA DE PRECIO",
            lineas=[{"detalle_origen_id": uuid4(), "cantidad_base": "1"}],
        )


def test_nota_no_admite_repetir_renglon() -> None:
    detalle_id = uuid4()
    with pytest.raises(ValidationError):
        NotaCreditoCrear(
            tipo="CLIENTE",
            documento_origen_id=uuid4(),
            motivo="DEVOLUCION COMPLETA",
            lineas=[
                {"detalle_origen_id": detalle_id, "cantidad_base": "1"},
                {"detalle_origen_id": detalle_id, "cantidad_base": "1"},
            ],
        )
