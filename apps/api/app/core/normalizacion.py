"""Reglas comunes de normalizacion de textos persistidos."""


def normalizar_mayusculas(valor: str) -> str:
    """Quita espacios externos y convierte texto de negocio a mayusculas."""
    return valor.strip().upper()
