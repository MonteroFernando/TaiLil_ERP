from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import configuracion

gestor_contrasenas = PasswordHash.recommended()


def crear_hash_contrasena(contrasena: str) -> str:
    return gestor_contrasenas.hash(contrasena)


def verificar_contrasena(contrasena: str, hash_guardado: str) -> bool:
    return gestor_contrasenas.verify(contrasena, hash_guardado)


def crear_token_acceso(usuario_id: UUID, sesion_id: UUID) -> str:
    ahora = datetime.now(UTC)
    contenido = {
        "sub": str(usuario_id),
        "sid": str(sesion_id),
        "jti": str(uuid4()),
        "tipo": "acceso",
        "iat": ahora,
        "exp": ahora + timedelta(minutes=configuracion.jwt_acceso_minutos),
    }
    return jwt.encode(
        contenido,
        configuracion.jwt_secreto_acceso,
        algorithm=configuracion.jwt_algoritmo,
    )


def crear_token_refresco(usuario_id: UUID, sesion_id: UUID) -> str:
    ahora = datetime.now(UTC)
    contenido = {
        "sub": str(usuario_id),
        "sid": str(sesion_id),
        "jti": str(uuid4()),
        "tipo": "refresco",
        "iat": ahora,
        "exp": ahora + timedelta(days=configuracion.jwt_refresco_dias),
    }
    return jwt.encode(
        contenido,
        configuracion.jwt_secreto_refresco,
        algorithm=configuracion.jwt_algoritmo,
    )


def decodificar_token_acceso(token: str) -> dict[str, object]:
    return jwt.decode(
        token,
        configuracion.jwt_secreto_acceso,
        algorithms=[configuracion.jwt_algoritmo],
    )


def decodificar_token_refresco(token: str) -> dict[str, object]:
    return jwt.decode(
        token,
        configuracion.jwt_secreto_refresco,
        algorithms=[configuracion.jwt_algoritmo],
    )


def crear_hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
