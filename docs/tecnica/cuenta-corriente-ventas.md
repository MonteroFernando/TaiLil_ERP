# Cuenta corriente de ventas

## Configuracion

`cuentas_corrientes_ventas` mantiene una fila unica por `socio_id`, solamente para socios clientes. PostgreSQL valida importes no negativos, `limite_periodo <= limite_deuda`, dias no negativos y temporalidades `diaria`, `semanal` o `mensual`. La API exige limite total mayor que cero cuando esta activa.

Rutas:

- `GET /api/v1/articulos/socios/{id}/cuenta-corriente-ventas`;
- `PUT /api/v1/articulos/socios/{id}/cuenta-corriente-ventas`.

La escritura requiere `ventas.cuenta_corriente.configurar`. El alta integral aplica el mismo control si incluye configuracion crediticia.

## Evaluacion calculada

La lectura devuelve configuracion mas `deuda_actual`, `consumo_periodo`, `credito_disponible`, `saldo_favor`, `disponible_total` y `deuda_vencida`.

- `deuda_actual`: suma de `venta_documentos.saldo_pendiente` para ventas confirmadas del cliente;
- `consumo_periodo`: ventas financiadas dentro del comienzo de la temporalidad configurada;
- `credito_disponible`: `max(0, min(limite_deuda - deuda_actual, limite_periodo - consumo_periodo))`;
- `saldo_favor`: cobros confirmados menos imputaciones activas;
- `disponible_total`: `saldo_favor + credito_disponible`.

Si la cuenta esta inactiva, falta configuracion o existe deuda vencida, `credito_disponible` es cero. `saldo_favor` no se anula porque representa fondos recibidos. Estos campos se calculan desde documentos financieros existentes; no requieren una tabla de saldo duplicada.

## Aplicacion POS

Durante la confirmacion, el servidor calcula el saldo pendiente a dos decimales. Para el cliente seleccionado obtiene cobros con disponible, los ordena por `fecha_realizacion` y numero, y bloquea sus filas con `SELECT ... FOR UPDATE`. Crea imputaciones hasta cubrir la nueva venta o agotar el anticipo. Luego valida el remanente contra el credito autorizado.

La venta, sus cobros nuevos, la aplicacion de anticipos, el saldo pendiente y los movimientos de stock se confirman en la misma transaccion. Esto evita consumir dos veces un anticipo o dejar una venta confirmada sin sus impactos.

Las conciliaciones posteriores y anulaciones se describen en [Tesoreria](tesoreria.md).
