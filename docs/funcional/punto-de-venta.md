# Punto de venta

## Alcance inicial

El punto de venta registra operaciones comerciales internas. En esta etapa no genera factura electronica, CAE ni comunicacion con ARCA.

Los documentos confirmados se denominan **PRESUPUESTOS**, utilizan la letra **T** y se identifican como `T 0001-00000001`: letra, punto de venta y numero consecutivo.

## Puntos de venta y cajas

Los administradores disponen de **Ventas → Configuracion POS** para crear puntos de venta y sus cajas. Cada punto define codigo, descripcion, almacen, letra `T`, tipo `PRESUPUESTO` y ultimo numero utilizado. Una caja pertenece a un unico punto de venta.

Antes de vender, el cajero debe abrir una caja e indicar el efectivo inicial. Una caja y un usuario solamente pueden poseer una apertura activa. Si el navegador se cierra, la apertura permanece en el servidor y el mismo usuario la recupera al volver. Un administrador puede consultar y operar cualquier caja abierta; un cajero no puede utilizar la apertura de otra persona.

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
5. Al confirmar, se asigna el siguiente numero del punto de venta, se genera la venta y se descuenta el stock de los productos inventariables.
6. Si hay pagos, se genera un cobro y se imputa a la venta.

Todos los precios del POS son brutos. El neto y el IVA se desglosan usando la alicuota configurada en cada articulo.

La seleccion de cliente es opcional. Cuando no se indica uno, la venta se registra automaticamente a nombre de **CONSUMIDOR FINAL**. Como este cliente predeterminado no posee cuenta corriente, la operacion debe quedar totalmente pagada.

El total permanece visible en la parte superior durante toda la carga. La tecla **F10** abre la ventana de cobro desde cualquier lugar de la pantalla, incluso cuando el cursor esta dentro de un campo; **Escape** la cierra. El boton **Cobrar F10** ofrece la misma accion para el uso con mouse o pantalla tactil.

Cuando una regla por cantidad cambia la lista y obtiene un importe menor que GENERAL, la linea identifica el descuento, muestra el precio GENERAL tachado y destaca el nuevo precio aplicado.

La tecla **F2** lleva al buscador de productos desde cualquier lugar de la pantalla. El buscador admite codigo interno, descripcion, codigo de barras y codigo de proveedor. Al elegir con **Enter**, el foco permanece en la busqueda para cargar inmediatamente el siguiente producto. **Tab** permite pasar a la cantidad cuando sea necesario; los productos pesables admiten peso con decimales. Al confirmar la cantidad con **Enter**, el foco vuelve al buscador.

El buscador acepta el formato `cantidad*codigo`, por ejemplo `12*7791234567890`. En ese caso busca el codigo indicado y agrega directamente la cantidad multiplicada. Los multiplicadores decimales solo se admiten en productos pesables.
El total visible de la linea, el total general y el importe sugerido para cobrar se calculan con esa cantidad multiplicada; los tres deben coincidir antes de confirmar.

Si se vuelve a buscar un articulo que ya se encuentra en la venta, no se crea otra linea: la cantidad indicada se suma a la existente y se recalculan la lista y el precio aplicables.

## Venta inmediata y cuenta corriente

- Si los pagos cubren el total, la venta queda sin saldo pendiente.
- Si la conexion con el servidor se interrumpe al confirmar, el POS conserva el comprobante y permite reintentar. La venta no se considera confirmada sin respuesta de la API.
- Los importes se comparan a dos decimales. Una diferencia tecnica de hasta un centavo por redondeo se incorpora al ultimo medio de pago y no activa la cuenta corriente.
- Si queda saldo, el cliente debe poseer una cuenta corriente de ventas activa.
- Se controlan el limite total de deuda, el limite por temporalidad y la antiguedad maxima de la deuda mas antigua.
- Un cliente sin cuenta corriente activa no puede confirmar una venta con saldo pendiente.

La venta, el cobro, la imputacion y el movimiento de stock se confirman juntos. Si una validacion falla, no se registra ninguna parte de la operacion.

Si la confirmacion es rechazada —por ejemplo, por limites de credito o una configuracion incompleta— el motivo se muestra dentro de la ventana de cobro y el borrador permanece disponible para corregirlo. El stock insuficiente no bloquea la venta: el saldo fisico puede quedar negativo.

## Borradores

Al cargar el primer producto se crea automaticamente una cabecera en estado **BORRADOR**. Los cambios de cliente, cantidades y productos se guardan con una espera breve para no interrumpir la carga. El borrador conserva cabecera, totales y lineas, pero no recibe numero, no genera pago y no mueve stock.

El boton **Recuperar borradores** muestra los pendientes de la apertura. Se pueden recuperar o eliminar. Una seleccion repetida del mismo articulo acumula cantidad en la misma linea. La confirmacion fuerza un ultimo guardado antes de numerar para impedir que una operacion pendiente quede desactualizada.

## Numeracion y confirmacion

Los borradores no consumen numeracion. El numero se asigna al confirmar dentro de la misma transaccion que genera deuda, cobro, imputacion y stock. El punto de venta se bloquea durante ese instante para que dos cajas concurrentes no obtengan el mismo numero. El historial de stock identifica la operacion como `PRESUPUESTO` y guarda el numero completo.

## Impresion y reimpresion

Un presupuesto confirmado puede imprimirse como ticket termico de **80 mm** o en **A4**. Ambos formatos muestran `PRESUPUESTO`, numero completo, fecha y hora, caja, cliente, lineas y totales, junto con la leyenda **DOCUMENTO INTERNO - NO VALIDO COMO FACTURA**.

Las reimpresiones usan los valores historicos guardados; no recalculan precios y no vuelven a generar deuda, cobro o stock. Cada solicitud queda registrada con usuario, fecha y formato. Desde la segunda impresion se identifica como **REIMPRESION**.

## Dashboard

El resumen principal incorpora ventas confirmadas del dia, cantidad de borradores, estado de la caja propia y efectivo esperado, calculado como efectivo inicial mas cobros en efectivo de la apertura.

## Trazabilidad

Cada documento conserva su numero, estado, usuario responsable y fecha y hora de realizacion. El movimiento de stock referencia el numero de venta. Las anulaciones se implementaran sobre el documento original; el historial de stock continuara siendo solo de consulta.
