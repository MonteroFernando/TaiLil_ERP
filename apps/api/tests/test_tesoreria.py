from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.main import app
from app.modules.articulos.infrastructure.models import VentaDocumentoDetalle
from app.modules.tesoreria.api.schemas import (
    CierreCajaCrear,
    CuentaCorrienteClienteResumen,
    CuentaCorrienteProveedorResumen,
    DocumentoTesoreriaCrear,
)


def test_documento_admite_conciliacion_muchos_a_muchos_y_saldo_disponible() -> None:
    datos = DocumentoTesoreriaCrear.model_validate(
        {
            "socio_id": uuid4(),
            "medios": [{"medio": "TRANSFERENCIA", "importe": "1500.00"}],
            "imputaciones": [
                {"documento_id": uuid4(), "importe": "600.00"},
                {"documento_id": uuid4(), "importe": "400.00"},
            ],
        }
    )
    assert sum(x.importe for x in datos.imputaciones) == 1000
    assert sum(x.importe for x in datos.medios) == 1500


def test_documento_rechaza_sobreimputacion() -> None:
    with pytest.raises(ValidationError):
        DocumentoTesoreriaCrear.model_validate(
            {
                "socio_id": uuid4(),
                "medios": [{"medio": "EFECTIVO", "importe": "100.00"}],
                "imputaciones": [{"documento_id": uuid4(), "importe": "100.01"}],
            }
        )


def test_cierre_exige_declaracion_de_efectivo() -> None:
    with pytest.raises(ValidationError):
        CierreCajaCrear.model_validate(
            {"medios": [{"medio": "TRANSFERENCIA", "declarado": "10.00"}]}
        )


def test_informes_y_costo_historico_estan_disponibles() -> None:
    assert "costo_unitario_bruto" in VentaDocumentoDetalle.__table__.columns
    rutas = app.openapi()["paths"]
    assert "/api/v1/informes/flujo-dinero" in rutas
    assert "/api/v1/informes/ventas-margenes" in rutas


def test_listado_general_cuentas_corrientes_clientes_esta_disponible() -> None:
    rutas = app.openapi()["paths"]
    assert "/api/v1/tesoreria/cuentas-corrientes/clientes/resumen" in rutas


def test_resumen_cuenta_cliente_conserva_importes_numericos() -> None:
    resumen = CuentaCorrienteClienteResumen.model_validate(
        {
            "socio_id": uuid4(),
            "codigo": "00001",
            "razon_social": "CLIENTE DE PRUEBA",
            "numero_documento": "20123456789",
            "cuenta_configurada": True,
            "cuenta_activa": True,
            "deuda_actual": "1250.50",
            "saldo_favor": "300.25",
            "documentos_pendientes": 2,
            "deuda_mas_antigua": None,
        }
    )
    assert resumen.deuda_actual == Decimal("1250.50")
    assert resumen.saldo_favor == Decimal("300.25")


def test_listado_general_cuentas_proveedores_esta_disponible() -> None:
    rutas = app.openapi()["paths"]
    assert "/api/v1/tesoreria/cuentas-corrientes/proveedores/resumen" in rutas
    resumen = CuentaCorrienteProveedorResumen.model_validate(
        {
            "socio_id": uuid4(),
            "codigo": "P0001",
            "razon_social": "PROVEEDOR DE PRUEBA",
            "numero_documento": "30712345678",
            "deuda_actual": "800.50",
            "saldo_favor": "120.25",
            "documentos_pendientes": 1,
            "deuda_mas_antigua": None,
        }
    )
    assert resumen.deuda_actual == Decimal("800.50")
    assert resumen.saldo_favor == Decimal("120.25")
