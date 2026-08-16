# Dashboard modular

`GET /api/v1/dashboard` devuelve exclusivamente las tarjetas habilitadas para el usuario autenticado. El registro de tarjetas asocia cada indicador con su modulo y permiso.

- `ultimos_movimientos`: comun a todos y, cuando exista el registro de actividad, filtrado por usuario.
- `ventas_dia`: requiere `ventas.ver`.
- `gastos_dia`: requiere `finanzas.ver`.
- `cashflow`: requiere `tesoreria.ver`.
- `estado_stock`: requiere `inventario.ver`.

Mientras un modulo no tenga movimientos persistidos, la API devuelve la tarjeta como preparada pero sin valor. No se generan importes ni cantidades ficticias.
