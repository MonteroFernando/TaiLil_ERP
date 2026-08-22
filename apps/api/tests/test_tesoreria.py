from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.main import app
from app.modules.articulos.api.schemas import AperturaCajaCrear, FacturaCompraCrear
from app.modules.articulos.infrastructure.models import (
    AperturaCaja,
    FacturaCompra,
    ImputacionCobroVenta,
    VentaDocumentoDetalle,
)
from app.modules.notas_credito.api.schemas import NotaCreditoCrear
from app.modules.tesoreria.api import router as tesoreria_router
from app.modules.tesoreria.api.schemas import (
    CierreCajaCrear,
    CuentaCorrienteClienteResumen,
    CuentaCorrienteProveedorResumen,
    DocumentoTesoreriaCrear,
    RetiroCajaCrear,
)
from app.modules.tesoreria.infrastructure.models import ImputacionPagoFactura, MovimientoCaja


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


def test_conciliacion_parcial_puede_completarse_en_otro_momento() -> None:
    indices_cobros = {indice.name: indice for indice in ImputacionCobroVenta.__table__.indexes}
    indices_pagos = {indice.name: indice for indice in ImputacionPagoFactura.__table__.indexes}
    assert "uq_imputacion_cobro_venta_activa" not in indices_cobros
    assert "uq_imputacion_pago_factura_activa" not in indices_pagos


def test_retiro_a_proveedor_exige_proveedor_y_es_trazable() -> None:
    with pytest.raises(ValidationError):
        RetiroCajaCrear.model_validate(
            {
                "apertura_caja_id": uuid4(),
                "destino": "PAGO_PROVEEDOR",
                "importe": "1000.00",
                "concepto": "ANTICIPO DE COMPRA",
            }
        )
    assert {"categoria", "proveedor_id", "referencia"} <= set(
        MovimientoCaja.__table__.columns.keys()
    )
    assert "/api/v1/tesoreria/cajas/retiros" in app.openapi()["paths"]


@pytest.mark.asyncio
async def test_gasto_directo_rechaza_proveedor_inexistente(monkeypatch) -> None:
    validar_apertura = AsyncMock()
    monkeypatch.setattr(tesoreria_router, "validar_apertura", validar_apertura)
    sesion = AsyncMock()
    sesion.get.return_value = None
    datos = RetiroCajaCrear.model_validate(
        {
            "apertura_caja_id": uuid4(),
            "destino": "GASTO_DIRECTO",
            "importe": "1000.00",
            "concepto": "COMPRA DE INSUMOS",
            "proveedor_id": uuid4(),
        }
    )

    with pytest.raises(HTTPException) as error:
        await tesoreria_router.crear_retiro(
            datos,
            usuario=SimpleNamespace(id=uuid4()),
            sesion=sesion,
        )

    assert error.value.status_code == 400
    assert error.value.detail == "Proveedor inexistente o inactivo"
    sesion.commit.assert_not_awaited()


def test_factura_proveedor_normaliza_y_protege_comprobante_duplicado() -> None:
    datos = FacturaCompraCrear.model_validate(
        {
            "proveedor_id": uuid4(),
            "almacen_id": uuid4(),
            "letra": "a",
            "punto_emision": "3",
            "numero_factura": "1254",
            "politica_costo": "NO_MODIFICAR",
            "lineas": [
                {
                    "articulo_id": uuid4(),
                    "cantidad_base": "1",
                    "costo_bruto_unitario": "100.00",
                }
            ],
        }
    )
    restricciones = {restriccion.name for restriccion in FacturaCompra.__table__.constraints}

    assert (datos.letra, datos.punto_emision, datos.numero_factura) == (
        "A",
        "00003",
        "00001254",
    )
    assert "uq_factura_compra_comprobante_proveedor" in restricciones


def test_documento_rechaza_sobreimputacion() -> None:
    with pytest.raises(ValidationError):
        DocumentoTesoreriaCrear.model_validate(
            {
                "socio_id": uuid4(),
                "medios": [{"medio": "EFECTIVO", "importe": "100.00"}],
                "imputaciones": [{"documento_id": uuid4(), "importe": "100.01"}],
            }
        )


def test_nota_credito_narrativa_admite_importe_sin_stock_ni_renglones() -> None:
    nota = NotaCreditoCrear.model_validate(
        {
            "tipo": "CLIENTE",
            "documento_origen_id": uuid4(),
            "modalidad": "NARRATIVA",
            "importe_narrativo": "1250.50",
            "motivo": "Diferencia de precio acordada",
            "afecta_stock": True,
        }
    )
    assert nota.lineas == []
    assert nota.afecta_stock is False
    assert nota.importe_narrativo == Decimal("1250.50")


def test_devolucion_de_nota_exige_caja_y_medio_juntos() -> None:
    with pytest.raises(ValidationError):
        NotaCreditoCrear.model_validate(
            {
                "tipo": "CLIENTE",
                "documento_origen_id": uuid4(),
                "modalidad": "NARRATIVA",
                "importe_narrativo": "100.00",
                "motivo": "Diferencia de precio",
                "apertura_caja_id": uuid4(),
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
    assert "/api/v1/informes/filtros/clientes" in rutas
    assert "/api/v1/informes/filtros/articulos" in rutas
    parametros = {
        parametro["name"]
        for parametro in rutas["/api/v1/informes/ventas-margenes"]["get"]["parameters"]
    }
    assert {"desde", "hasta", "cliente_id", "articulo_id", "limite"} <= parametros


def test_listado_general_cuentas_corrientes_clientes_esta_disponible() -> None:
    rutas = app.openapi()["paths"]
    assert "/api/v1/tesoreria/cuentas-corrientes/clientes/resumen" in rutas
    assert "/api/v1/articulos/pos/ventas/{venta_id}" in rutas


def test_resumen_cuenta_cliente_conserva_importes_numericos() -> None:
    resumen = CuentaCorrienteClienteResumen.model_validate(
        {
            "socio_id": uuid4(),
            "codigo": "00001",
            "razon_social": "CLIENTE DE PRUEBA",
            "numero_documento": "20123456789",
            "cuenta_configurada": True,
            "cuenta_activa": True,
            "limite_asignado": "5000.00",
            "credito_ocupado": "1250.50",
            "credito_disponible": "3749.50",
            "deuda_individual": "1250.50",
            "saldo_favor_individual": "300.25",
            "documentos_individuales": 2,
            "deuda_actual": "1250.50",
            "saldo_favor": "300.25",
            "documentos_pendientes": 2,
            "deuda_mas_antigua": None,
        }
    )
    assert resumen.deuda_actual == Decimal("1250.50")
    assert resumen.saldo_favor == Decimal("300.25")
    assert resumen.limite_asignado == Decimal("5000.00")
    assert resumen.credito_ocupado == Decimal("1250.50")
    assert resumen.credito_disponible == Decimal("3749.50")


def test_listado_general_cuentas_proveedores_esta_disponible() -> None:
    rutas = app.openapi()["paths"]
    assert "/api/v1/tesoreria/cuentas-corrientes/proveedores/resumen" in rutas
    resumen = CuentaCorrienteProveedorResumen.model_validate(
        {
            "socio_id": uuid4(),
            "codigo": "P0001",
            "razon_social": "PROVEEDOR DE PRUEBA",
            "numero_documento": "30712345678",
            "deuda_individual": "800.50",
            "saldo_favor_individual": "120.25",
            "documentos_individuales": 1,
            "deuda_actual": "800.50",
            "saldo_favor": "120.25",
            "documentos_pendientes": 1,
            "deuda_mas_antigua": None,
        }
    )
    assert resumen.deuda_actual == Decimal("800.50")
    assert resumen.saldo_favor == Decimal("120.25")


def test_cuentas_vinculadas_resuelven_la_deuda_en_la_raiz_por_rol() -> None:
    padre_id, hija_id, nieta_id, independiente_id = (uuid4() for _ in range(4))
    socios = [
        SimpleNamespace(
            id=padre_id,
            cuenta_padre_cliente_id=None,
            cuenta_padre_proveedor_id=None,
        ),
        SimpleNamespace(
            id=hija_id,
            cuenta_padre_cliente_id=padre_id,
            cuenta_padre_proveedor_id=None,
        ),
        SimpleNamespace(
            id=nieta_id,
            cuenta_padre_cliente_id=hija_id,
            cuenta_padre_proveedor_id=None,
        ),
        SimpleNamespace(
            id=independiente_id,
            cuenta_padre_cliente_id=None,
            cuenta_padre_proveedor_id=None,
        ),
    ]

    raices = tesoreria_router.resolver_raices_cuentas(socios, "cliente")

    assert raices[padre_id] == padre_id
    assert raices[hija_id] == padre_id
    assert raices[nieta_id] == padre_id
    assert raices[independiente_id] == independiente_id

    socios[1].cuenta_padre_cliente_id = None
    raices_desvinculadas = tesoreria_router.resolver_raices_cuentas(socios, "cliente")

    assert raices_desvinculadas[hija_id] == hija_id
    assert raices_desvinculadas[nieta_id] == hija_id


@pytest.mark.asyncio
async def test_cuenta_padre_ve_el_grupo_y_la_hija_solo_su_deuda() -> None:
    padre_id, hija_id, otra_id = (uuid4() for _ in range(3))
    socios = [
        SimpleNamespace(id=padre_id, cuenta_padre_cliente_id=None),
        SimpleNamespace(id=hija_id, cuenta_padre_cliente_id=padre_id),
        SimpleNamespace(id=otra_id, cuenta_padre_cliente_id=None),
    ]
    sesion = SimpleNamespace(scalars=AsyncMock(return_value=socios))

    visibles_padre = await tesoreria_router.ids_cuenta_visible(
        padre_id, "cliente", sesion
    )
    visibles_hija = await tesoreria_router.ids_cuenta_visible(
        hija_id, "cliente", sesion
    )
    grupo_hija = await tesoreria_router.ids_grupo_completo(
        hija_id, "cliente", sesion
    )

    assert visibles_padre == {padre_id, hija_id}
    assert visibles_hija == {hija_id}
    assert grupo_hija == {padre_id, hija_id}


def test_apertura_se_vincula_a_un_periodo_operativo_no_unico() -> None:
    periodo = date(2026, 8, 22)
    primera = AperturaCajaCrear(
        caja_id=uuid4(), efectivo_inicial="10000.00", periodo_operativo=periodo
    )
    segunda = AperturaCajaCrear(
        caja_id=uuid4(), efectivo_inicial="25000.00", periodo_operativo=periodo
    )
    assert primera.periodo_operativo == segunda.periodo_operativo == periodo
    assert "periodo_operativo" in AperturaCaja.__table__.columns


def test_historial_cierres_admite_busqueda_por_dia_y_rango() -> None:
    parametros = {
        parametro["name"]
        for parametro in app.openapi()["paths"]["/api/v1/tesoreria/cajas/cierres/historial"]["get"][
            "parameters"
        ]
    }
    assert {"periodo", "desde", "hasta", "limite"} <= parametros
