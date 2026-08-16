# Configuracion tecnica de cuenta corriente de ventas

`cuentas_corrientes_ventas` mantiene una configuracion unica por `socio_id`. Solo se acepta para socios con rol cliente.

La base valida importes no negativos, `limite_periodo <= limite_deuda`, dias no negativos y temporalidades `diaria`, `semanal` o `mensual`. La API exige un limite total mayor que cero cuando la cuenta esta activa.

Rutas:

- `GET /api/v1/articulos/socios/{id}/cuenta-corriente-ventas`
- `PUT /api/v1/articulos/socios/{id}/cuenta-corriente-ventas`

La escritura requiere `ventas.cuenta_corriente.configurar`. El alta integral de socios comprueba el mismo permiso solamente si incluye una configuracion crediticia. La evaluacion de saldo, consumo del periodo y deuda mas antigua se incorporara con los movimientos de cuenta corriente e imputaciones de pago; no se simulan saldos en esta tabla de configuracion.
