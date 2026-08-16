from app.modules.articulos.api.schemas import ClienteCrear


def test_cliente_nuevo_es_consumidor_final_con_dni() -> None:
    cliente = ClienteCrear(
        codigo="C0001",
        razon_social="Cliente de prueba",
        numero_documento="30111222",
    )
    assert cliente.tipo_persona == "fisica"
    assert cliente.tipo_documento == "DNI"
    assert cliente.condicion_iva_codigo == 5
