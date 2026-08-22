# Notas de credito

## Acceso

Desde **Punto de venta → Notas de credito** se crean notas para clientes. Desde **Compras → Notas de credito** se registran las emitidas por proveedores. La pantalla conserva ambos sectores separados.

Para clientes se requiere `ventas.ver` para consultar y `ventas.gestionar` para confirmar. Para proveedores se utilizan `compras.ver` y `compras.gestionar`.

## Procedimiento

1. Elegir **Clientes / POS** o **Proveedores**.
2. Buscar el comprobante original por socio o numero.
3. Seleccionarlo y cargar la cantidad a acreditar en cada renglon.
4. Indicar un motivo de al menos cinco caracteres.
5. Para proveedores, ingresar el numero de nota emitido por el proveedor.
6. Definir si existe devolucion fisica de mercaderia.
7. Revisar el total y confirmar en el modal.

No se reingresan precios manualmente: se utiliza el precio bruto historico de la venta o el costo bruto historico de la factura. La cantidad acumulada de notas nunca puede superar la cantidad del renglon original.

## Cuenta corriente y stock

La nota se aplica primero al saldo pendiente original. El excedente queda disponible para futuras conciliaciones: como saldo a favor del cliente o como credito del proveedor. No es entrada ni salida de dinero; una devolucion de efectivo se registra por separado.

Con **Devolver mercaderia** activo, la nota de cliente reingresa productos inventariables al almacen de la venta y la de proveedor los descuenta para devolverlos. Para diferencias de precio, bonificaciones o servicios se desmarca la opcion.

## Historico

Cada nota conserva numero interno `NC`, tipo, socio, origen, numero externo, motivo, cantidades, importes, usuario, fecha, efecto de stock y documentos financieros. El historico puede exportarse a Excel e imprimirse. Una nota confirmada no se elimina ni modifica.
