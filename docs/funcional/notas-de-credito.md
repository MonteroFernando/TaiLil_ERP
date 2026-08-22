# Notas de credito

## Acceso

Desde el boton **Emitir N/C** del Punto de venta se abre la gestion en un modal, sin abandonar el POS. Desde **Compras → Notas de credito** se registran las emitidas por proveedores. La pantalla general conserva ambos sectores separados.

Para consultar notas de clientes se requiere `ventas.ver`. Para emitirlas se exige el permiso independiente `ventas.notas_credito.emitir`, asignado expresamente por un administrador. `ventas.gestionar`, `ventas.caja.operar` y el perfil **CAJERO** no habilitan esta operacion. Para proveedores se utilizan `compras.ver` y `compras.gestionar`.

## Procedimiento

1. Elegir **Clientes / POS** o **Proveedores**.
2. Buscar el comprobante original por socio o numero.
3. Seleccionarlo y cargar la cantidad a acreditar en cada renglon.
4. Indicar un motivo de al menos cinco caracteres.
5. Para proveedores, ingresar el numero de nota emitido por el proveedor.
6. Definir si existe devolucion fisica de mercaderia.
7. Revisar el total y confirmar en el modal.

Para una diferencia de precio se elige **Narrativa / diferencia de precio**, se indica el importe y se describe el motivo. Esta modalidad no mueve stock y queda igualmente vinculada a una factura concreta.

No se reingresan precios manualmente: se utiliza el precio bruto historico de la venta o el costo bruto historico de la factura. La cantidad acumulada de notas nunca puede superar la cantidad del renglon original.

## Cuenta corriente y stock

La nota se aplica primero al saldo pendiente original. El excedente queda disponible para futuras conciliaciones como saldo a favor del cliente. En el POS puede activarse **Devolver el saldo por esta caja**: el excedente se devuelve por el medio elegido, se registra como egreso de la apertura actual y no queda duplicado como saldo a favor.

Con **Devolver mercaderia** activo, la nota de cliente reingresa productos inventariables al almacen de la venta y la de proveedor los descuenta para devolverlos. Para diferencias de precio, bonificaciones o servicios se desmarca la opcion.

## Historico

Cada nota conserva numero interno `NC`, tipo, modalidad, socio, factura vinculada, numero externo, motivo, cantidades, importes, usuario, fecha, efecto de stock, devolucion de caja y documentos financieros. El historico puede exportarse a Excel e imprimirse. Una nota confirmada no se elimina ni modifica.
