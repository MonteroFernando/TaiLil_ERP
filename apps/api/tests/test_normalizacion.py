from app.core.normalizacion import normalizar_mayusculas


def test_normaliza_texto_de_negocio_en_mayusculas() -> None:
    assert normalizar_mayusculas("  Caja x 12 ágil  ") == "CAJA X 12 ÁGIL"
