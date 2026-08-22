from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.articulos.api.schemas import (
    ArticuloCrear,
    ArticuloUnidadCrear,
    CodigoBarraCrear,
    DescripcionPosActualizar,
    PosVentaCrear,
    PrecioVentaConsultaVista,
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


def test_producto_admite_stock_inicial_por_almacen() -> None:
    almacen_id = uuid4()
    articulo = ArticuloCrear(
        descripcion="Producto con existencia inicial",
        unidad_base_id=uuid4(),
        alicuota_iva_id=uuid4(),
        stock_inicial=[{"almacen_id": almacen_id, "cantidad": "25.500000"}],
    )
    assert articulo.stock_inicial[0].almacen_id == almacen_id
    assert articulo.stock_inicial[0].cantidad == Decimal("25.500000")


def test_stock_inicial_requiere_inventario_y_almacenes_unicos() -> None:
    almacen_id = uuid4()
    base = {
        "descripcion": "Producto de prueba",
        "unidad_base_id": uuid4(),
        "alicuota_iva_id": uuid4(),
    }
    with pytest.raises(ValidationError):
        ArticuloCrear(
            **base,
            habilitado_inventario=False,
            stock_inicial=[{"almacen_id": almacen_id, "cantidad": "1"}],
        )
    with pytest.raises(ValidationError):
        ArticuloCrear(
            **base,
            stock_inicial=[
                {"almacen_id": almacen_id, "cantidad": "1"},
                {"almacen_id": almacen_id, "cantidad": "2"},
            ],
        )


def test_consulta_pos_solo_expone_precio_de_venta() -> None:
    campos = set(PrecioVentaConsultaVista.model_fields)
    assert campos == {
        "lista_id",
        "lista_nombre",
        "articulo_id",
        "articulo_codigo",
        "articulo_descripcion",
        "precio_venta_bruto",
    }
    assert "precio_base_bruto" not in campos
    assert "margen_porcentual" not in campos


def test_descripcion_pos_requiere_un_texto_valido() -> None:
    assert DescripcionPosActualizar(descripcion="CAJA PRINCIPAL").descripcion == "CAJA PRINCIPAL"
    with pytest.raises(ValidationError):
        DescripcionPosActualizar(descripcion="X")


def test_pos_acepta_cuenta_corriente_como_eleccion_explicita() -> None:
    venta = PosVentaCrear(
        cliente_id=uuid4(),
        almacen_id=uuid4(),
        lineas=[{"articulo_id": uuid4(), "cantidad_base": "1"}],
        pagos=[{"medio": "CUENTA_CORRIENTE", "importe": "150.25"}],
    )
    assert venta.pagos[0].medio == "CUENTA_CORRIENTE"
    assert venta.pagos[0].importe == Decimal("150.25")


def test_pos_no_acepta_dos_imputaciones_a_cuenta_corriente() -> None:
    with pytest.raises(ValidationError, match="Solo se permite una imputacion"):
        PosVentaCrear(
            cliente_id=uuid4(),
            almacen_id=uuid4(),
            lineas=[{"articulo_id": uuid4(), "cantidad_base": "1"}],
            pagos=[
                {"medio": "CUENTA_CORRIENTE", "importe": "100"},
                {"medio": "CUENTA_CORRIENTE", "importe": "50"},
            ],
        )
