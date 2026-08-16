# Maestro de proveedores

## Objetivo

Registrar una sola vez cada proveedor para reutilizarlo en compras y en la vinculacion con articulos.

## Datos iniciales

- Codigo interno unico.
- Razon social.
- Estado activo o inactivo.

Los textos se guardan en mayusculas. El proveedor puede buscarse por codigo o razon social y sus datos pueden modificarse.

Desactivar un proveedor impide considerarlo disponible para nuevas operaciones cuando se construyan las compras, pero conserva sus relaciones e historial. No se elimina fisicamente.

El codigo propio que un proveedor asigna a un articulo se mantiene en la relacion articulo-proveedor y no en este maestro.
