from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.articulos.api.schemas import (
    ArticuloCrear,
    ArticuloUnidadCrear,
    CodigoBarraCrear,
)


def test_codigo_por_cantidad_usa_unidad_predeterminada() -> None:
    codigo = CodigoBarraCrear(codigo="779000000001", modo_contenido="cantidad")
    assert codigo.cantidad == Decimal("1")
    assert codigo.articulo_unidad_id is None


def test_nueva_presentacion_no_es_alternativa_automaticamente() -> None:
    presentacion = ArticuloUnidadCrear(
        unidad_medida_id=uuid4(),
        nombre_presentacion="Bulto x 6",
        factor_a_base=Decimal("6"),
    )
    assert presentacion.es_unidad_alternativa is False


def test_codigo_por_presentacion_requiere_unidad_vinculada() -> None:
    with pytest.raises(ValidationError):
        CodigoBarraCrear(codigo="779000000002", modo_contenido="unidad")


def test_codigo_por_presentacion_acepta_unidad_vinculada() -> None:
    presentacion_id = uuid4()
    codigo = CodigoBarraCrear(
        codigo="779000000003",
        modo_contenido="unidad",
        articulo_unidad_id=presentacion_id,
    )
    assert codigo.articulo_unidad_id == presentacion_id


def test_producto_no_acepta_codigo_alfanumerico_manual() -> None:
    with pytest.raises(ValidationError):
        ArticuloCrear(
            tipo_articulo="producto",
            codigo_alternativo="MANUAL",
            descripcion="Producto de prueba",
            unidad_base_id=uuid4(),
            alicuota_iva_id=uuid4(),
        )


def test_servicio_requiere_letras_y_no_controla_inventario() -> None:
    servicio = ArticuloCrear(
        tipo_articulo="servicio",
        codigo_alternativo="FLETE01",
        descripcion="Servicio de flete",
        unidad_base_id=uuid4(),
        alicuota_iva_id=uuid4(),
        habilitado_inventario=False,
    )
    assert servicio.codigo_alternativo == "FLETE01"

    with pytest.raises(ValidationError):
        ArticuloCrear(
            tipo_articulo="servicio",
            codigo_alternativo="12345",
            descripcion="Servicio invalido",
            unidad_base_id=uuid4(),
            alicuota_iva_id=uuid4(),
            habilitado_inventario=False,
        )
