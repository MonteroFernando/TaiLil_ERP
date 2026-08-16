from uuid import uuid4

from app.core.seguridad import (
    crear_hash_contrasena,
    crear_hash_token,
    crear_token_acceso,
    decodificar_token_acceso,
    verificar_contrasena,
)


def test_hash_de_contrasena_es_irreversible_y_verificable() -> None:
    contrasena = "una-clave-de-prueba"
    hash_guardado = crear_hash_contrasena(contrasena)

    assert hash_guardado != contrasena
    assert verificar_contrasena(contrasena, hash_guardado)
    assert not verificar_contrasena("incorrecta", hash_guardado)


def test_token_de_acceso_contiene_usuario_y_sesion() -> None:
    usuario_id = uuid4()
    sesion_id = uuid4()

    token = crear_token_acceso(usuario_id, sesion_id)
    contenido = decodificar_token_acceso(token)

    assert contenido["sub"] == str(usuario_id)
    assert contenido["sid"] == str(sesion_id)
    assert contenido["tipo"] == "acceso"


def test_hash_del_token_no_expone_el_token() -> None:
    token = "token-de-prueba"
    assert crear_hash_token(token) != token
    assert crear_hash_token(token) == crear_hash_token(token)
