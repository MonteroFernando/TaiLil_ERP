from fastapi.testclient import TestClient

from app.main import app


def test_estado_del_sistema() -> None:
    with TestClient(app) as cliente:
        respuesta = cliente.get("/api/v1/sistema/estado")

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "operativo"
