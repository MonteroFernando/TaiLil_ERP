# Punto de venta

## Alcance inicial

El punto de venta registra operaciones comerciales internas. En esta etapa no genera factura electronica, CAE ni comunicacion con ARCA.

Los documentos confirmados se denominan **PRESUPUESTOS**, utilizan la letra **T** y se identifican como `T 0001-00000001`: letra, punto de venta y numero consecutivo.

## Puntos de venta y cajas

La descripcion de un punto o una caja puede modificarse. Se pueden eliminar fisicamente solo si no poseen aperturas, ventas, numeracion ni otro historial. La confirmacion se realiza en un modal de la aplicacion; si existe historia, el sistema rechaza la eliminacion y conserva el registro.

Los administradores disponen de **Ventas → Configuracion POS** para crear puntos de venta y sus cajas. Cada punto define codigo, descripcion, almacen, letra `T`, tipo `PRESUPUESTO` y ultimo numero utilizado. Una caja pertenece a un unico punto de venta.

Antes de vender, el cajero debe abrir una caja e indicar el efectivo inicial. Una caja y un usuario solamente pueden poseer una apertura activa. Si el navegador se cierra, la apertura permanece en el servidor y el mismo usuario la recupera al volver. Un administrador puede consultar y operar cualquier caja abierta; un cajero no puede utilizar la apertura de otra persona.

La operacion se divide en documentos relacionados:

- La **venta** registra los articulos, cantidades, precios brutos, IVA, cliente y almacen. Es el documento que genera la deuda.
- El **cobro** registra uno o varios medios de pago. Es el documento que cancela deuda.
- La **imputacion** indica que importe de un cobro se aplico a una venta.

Esta separacion permite que un cobro cancele varias ventas y que una venta reciba varios cobros; las conciliaciones posteriores se gestionan en Tesoreria.

## Flujo del POS

### Distribucion de la pantalla

En escritorio, el POS funciona como una mesa de trabajo de dos columnas. A la izquierda permanecen el buscador y el detalle de articulos; a la derecha se muestran el total, la cantidad de lineas, **Cobrar**, **Consulta de precios**, cliente, disponibilidad de cuenta corriente, almacen e impresion. El panel derecho conserva el total y la accion de cobro visibles durante toda la carga.

La grilla de articulos utiliza desplazamiento interno y encabezado fijo. Agregar filas no alarga la pagina ni desplaza el total: solamente se desplaza el contenido de la grilla. Las filas compactas mantienen visibles codigo, descripcion, cantidad editable, lista, precio, total y eliminacion. En pantallas pequeñas el resumen de cobro aparece primero y luego la carga de productos.

1. Se elige un cliente activo y un almacen.
2. Se agregan articulos habilitados para venta mediante la busqueda general.
3. El sistema resuelve automaticamente la lista aplicable segun la cantidad base.
4. Se elige expresamente uno o varios medios de pago. **CUENTA CORRIENTE** es una opcion separada, no un saldo inferido.
5. Al confirmar, se asigna el siguiente numero del punto de venta, se genera la venta y se descuenta el stock de los productos inventariables.
6. Si hay pagos, se genera un cobro y se imputa a la venta.

Todos los precios del POS son brutos. El neto y el IVA se desglosan usando la alicuota configurada en cada articulo.

La seleccion de cliente es opcional. Cuando no se indica uno, la venta se registra automaticamente a nombre de **CONSUMIDOR FINAL**. Como este cliente predeterminado no posee cuenta corriente, la operacion debe quedar totalmente pagada.

Al seleccionar un cliente, el POS consulta inmediatamente su cuenta corriente. Muestra siempre el **disponible total**, compuesto por el saldo a favor de cobros anticipados todavia no aplicados mas el credito autorizado disponible. Tambien informa cada componente, el limite total, la deuda actual y el disponible del periodo. El mismo resumen permanece visible dentro de la ventana de cobro.

Al abrir el cobro ningun medio se completa automaticamente. El operador debe indicar efectivo, tarjeta, transferencia u otro medio y, si corresponde financiar, pulsar **Usar cuenta corriente** o elegir **CUENTA_CORRIENTE**. El sistema propone el remanente en ese momento, pero lo mantiene visible como una eleccion independiente. La confirmacion solo se habilita cuando pagos inmediatos, saldo a favor y cuenta corriente cubren exactamente el total.

El sistema aplica primero los cobros anticipados mas antiguos. Esa aplicacion no vuelve a ingresar dinero en la caja porque el cobro original ya fue registrado. El ticket identifica cada cobro utilizado y muestra exactamente el importe aplicado a esa venta. El importe elegido como cuenta corriente genera saldo pendiente, pero nunca un ingreso ni un medio de caja.

El total permanece visible en la parte superior durante toda la carga. La tecla **F10** abre la ventana de cobro desde cualquier lugar de la pantalla, incluso cuando el cursor esta dentro de un campo; **Escape** la cierra. El boton **Cobrar F10** ofrece la misma accion para el uso con mouse o pantalla tactil.

Cuando una regla por cantidad cambia la lista y obtiene un importe menor que GENERAL, la linea identifica el descuento, muestra el precio GENERAL tachado y destaca el nuevo precio aplicado.

La tecla **F2** lleva al buscador de productos desde cualquier lugar de la pantalla. El buscador admite codigo interno, descripcion, codigo de barras y codigo de proveedor. Al elegir con **Enter**, el foco permanece en la busqueda para cargar inmediatamente el siguiente producto. **Tab** permite pasar a la cantidad cuando sea necesario; los productos pesables admiten peso con decimales. Al confirmar la cantidad con **Enter**, el foco vuelve al buscador.

Con un lector de barras se escanea el codigo y se presiona **Enter**: si hay una coincidencia exacta, el articulo se agrega directamente sin abrir pasos intermedios. **F3** abre en cualquier momento el modal **Consulta de precios**, con la misma busqueda por palabras en cualquier orden. La consulta muestra listas y precios de venta, nunca el costo ni la lista interna COMPRAS.

El buscador acepta el formato `cantidad*codigo`, por ejemplo `12*7791234567890`. En ese caso busca el codigo indicado y agrega directamente la cantidad multiplicada. Los multiplicadores decimales solo se admiten en productos pesables.
El total visible de la linea, el total general y el importe sugerido para cobrar se calculan con esa cantidad multiplicada; los tres deben coincidir antes de confirmar.

Si se vuelve a buscar un articulo que ya se encuentra en la venta, no se crea otra linea: la cantidad indicada se suma a la existente y se recalculan la lista y el precio aplicables.

## Venta inmediata y cuenta corriente

Las devoluciones totales o parciales se registran desde **Notas de credito** contra el presupuesto original. Se usan precios historicos, se controlan cantidades ya devueltas y se puede reingresar mercaderia. Ver [Notas de credito](notas-de-credito.md).

- Si los pagos cubren el total, la venta queda sin saldo pendiente.
- El saldo a favor se puede utilizar aunque la cuenta corriente no este habilitada o su credito se encuentre bloqueado por deuda vencida.
- Si la conexion con el servidor se interrumpe al confirmar, el POS conserva el comprobante y permite reintentar. La venta no se considera confirmada sin respuesta de la API.
- Los importes se comparan a dos decimales y la cobertura debe coincidir exactamente con el total; una diferencia nunca activa credito de manera implicita.
- Si queda saldo, debe seleccionarse expresamente **CUENTA CORRIENTE** por ese importe y el cliente debe poseer una cuenta corriente de ventas activa.
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

El selector del encabezado permite alternar entre **Vista previa** e **Impresion directa**. La vista previa conserva el flujo manual. En modo directo, al confirmar correctamente el cobro se genera el ticket de 80 mm, se envia a la impresora predeterminada y se cierra su ventana. La preferencia queda guardada en el navegador del puesto y tambien se utiliza en Etiquetas de precios.

Para omitir el dialogo de Windows, el puesto debe abrirse con `deploy/windows/Abrir-TaiLilERP-POS.ps1`. La guillotina se configura en el driver oficial como corte al finalizar el trabajo; de esta forma el corte se ejecuta despues del espacio final del ticket y no sobre su contenido.

Las reimpresiones usan los valores historicos guardados; no recalculan precios y no vuelven a generar deuda, cobro o stock. Cada solicitud queda registrada con usuario, fecha y formato. Desde la segunda impresion se identifica como **REIMPRESION**.

## Dashboard

El resumen principal incorpora ventas confirmadas del dia, cantidad de borradores, estado de la caja propia y efectivo esperado, calculado como efectivo inicial mas cobros en efectivo de la apertura.

## Trazabilidad

Cada documento conserva su numero, estado, usuario responsable y fecha y hora de realizacion. El movimiento de stock referencia el numero de venta. Las anulaciones se implementaran sobre el documento original; el historial de stock continuara siendo solo de consulta.
