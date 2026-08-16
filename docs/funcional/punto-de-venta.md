# Punto de venta

## Alcance inicial

El punto de venta registra operaciones comerciales internas. En esta etapa no genera factura electronica, CAE ni comunicacion con ARCA.

La operacion se divide en documentos relacionados:

- La **venta** registra los articulos, cantidades, precios brutos, IVA, cliente y almacen. Es el documento que genera la deuda.
- El **cobro** registra uno o varios medios de pago. Es el documento que cancela deuda.
- La **imputacion** indica que importe de un cobro se aplico a una venta.

Esta separacion permite que, en el futuro, un cobro cancele varias ventas y que una venta reciba varios cobros.

## Flujo del POS

1. Se elige un cliente activo y un almacen.
2. Se agregan articulos habilitados para venta mediante la busqueda general.
3. El sistema resuelve automaticamente la lista aplicable segun la cantidad base.
4. Se cargan cero, uno o varios medios de pago.
5. Al confirmar, se genera la venta y se descuenta el stock de los productos inventariables.
6. Si hay pagos, se genera un cobro y se imputa a la venta.

Todos los precios del POS son brutos. El neto y el IVA se desglosan usando la alicuota configurada en cada articulo.

El total permanece visible en la parte superior durante toda la carga. La tecla **Espacio**, cuando el foco no esta dentro de un campo, abre la ventana de cobro; **Escape** la cierra. El boton **Cobrar** ofrece la misma accion para el uso con mouse o pantalla tactil.

## Venta inmediata y cuenta corriente

- Si los pagos cubren el total, la venta queda sin saldo pendiente.
- Si queda saldo, el cliente debe poseer una cuenta corriente de ventas activa.
- Se controlan el limite total de deuda, el limite por temporalidad y la antiguedad maxima de la deuda mas antigua.
- Un cliente sin cuenta corriente activa no puede confirmar una venta con saldo pendiente.

La venta, el cobro, la imputacion y el movimiento de stock se confirman juntos. Si una validacion falla, no se registra ninguna parte de la operacion.

## Trazabilidad

Cada documento conserva su numero, estado, usuario responsable y fecha y hora de realizacion. El movimiento de stock referencia el numero de venta. Las anulaciones se implementaran sobre el documento original; el historial de stock continuara siendo solo de consulta.
