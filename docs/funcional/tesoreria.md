# Tesoreria, cuentas corrientes, conciliaciones y caja

## Objetivo

Tesoreria concentra el dinero recibido y pagado, las cuentas corrientes de clientes y proveedores, la conciliacion entre documentos y el control completo de cada caja. Se ingresa desde **Panel principal → Tesoreria**.

Los permisos son:

- `tesoreria.ver`: consultar cuentas, documentos, controles e historicos;
- `tesoreria.gestionar`: registrar cobros, pagos, conciliaciones, movimientos, arqueos y cierres.

## Flujo practico de una cuenta corriente

Al ingresar en **Cuentas corrientes → Clientes / cobros**, el **Listado general** muestra todos los clientes con deuda o saldo a favor. Se puede buscar por nombre, codigo o documento y filtrar por **con movimientos**, **solamente con deuda**, **solamente saldo a favor** o **todos los clientes**. La cabecera informa el total por cobrar y el total de anticipos a favor.

Cada fila muestra estado de la cuenta, cantidad de documentos pendientes, deuda mas antigua, deuda total y saldo a favor. Para clientes, el listado es la unica busqueda necesaria: **Abrir cuenta** presenta una ficha modal sin abandonar ni alargar la pantalla principal. La ficha contiene resumen, documentos con saldo real, registro de cobro, historial y conciliacion. Las ventas ya canceladas no aparecen como pendientes; si no existe deuda, se informa expresamente que no hay documentos donde imputar. El listado puede exportarse a Excel; deuda y saldo a favor se generan como valores numericos con formato monetario.

**Proveedores / pagos** utiliza el mismo diseño. Su listado general muestra total por pagar, facturas pendientes, deuda mas antigua y pagos confirmados todavia sin aplicar. **Abrir cuenta** presenta el modal del proveedor con facturas y pago, o historial y conciliacion. La busqueda individual inferior ya no se utiliza para ninguno de los dos tipos de cuenta.

1. Elegir **Clientes / cobros** o **Proveedores / pagos**.
2. Buscar por nombre, codigo o documento y seleccionar el socio.
3. Revisar el saldo pendiente y los pagos sin aplicar.
4. En **Documentos y registrar**, indicar cuanto se aplica a cada factura.
5. Registrar el cobro o pago, su medio, referencia y total.
6. Si sobra dinero, queda disponible en el mismo documento para conciliar despues.
7. En **Historial y conciliacion**, revisar lo ya aplicado o distribuir el saldo disponible entre otras facturas.

No es una relacion uno a uno: un cobro o pago puede aplicarse a varias facturas y una factura puede cancelarse con varios cobros o pagos. La suma imputada nunca puede superar el saldo de la factura ni el disponible del documento de pago.

## Clientes y proveedores

En clientes se muestran ventas confirmadas con saldo pendiente y se registran **cobros**. En proveedores se muestran facturas de compra con saldo pendiente y se registran **pagos**. El circuito es el mismo para que la pantalla sea predecible.

Cada cobro o pago guarda numero, socio, fecha y hora, usuario, total, observacion, medios y conciliaciones. Puede cargarse con una o varias facturas; la diferencia entre lo cobrado/pagado y lo conciliado queda como saldo sin aplicar.

Las notas de credito aparecen con medio `NOTA_CREDITO`: se aplican primero al comprobante original y el excedente puede conciliarse despues. No representan movimiento de efectivo ni alteran el arqueo.

Una conciliacion activa puede anularse indicando un motivo de al menos cinco caracteres. La anulacion restituye los saldos, pero no elimina el registro: quedan usuario, fecha, estado y motivo para auditoria.

## Cuenta corriente del cliente y POS

La deuda del cliente es la suma de los saldos pendientes de sus ventas confirmadas. El POS muestra siempre:

- deuda actual;
- consumo del periodo;
- credito autorizado disponible;
- saldo a favor;
- disponible total;
- advertencia de deuda vencida.

El **saldo a favor** es dinero cobrado anteriormente que todavia no fue aplicado. Se suma al credito autorizado aun cuando la cuenta corriente este inactiva o bloqueada por vencimiento. Al confirmar una venta, el POS aplica primero ese saldo a favor, desde los cobros mas antiguos, y solo financia el remanente que corresponda.

Ejemplo: con limite disponible de $50.000 y saldo a favor de $100.000, el disponible total mostrado es $150.000. El saldo a favor no aumenta el limite contractual: es dinero propio del cliente ya recibido.

Para una venta que no utiliza cuenta corriente, el cobro debe quedar conciliado al cerrar la facturacion. En una operacion financiada, el saldo pendiente queda visible en Tesoreria hasta su cobro y conciliacion.

## Caja y arqueo

En **Caja y arqueo** se selecciona una apertura activa. El control muestra ventas, cobros, pagos, ingresos y egresos de esa apertura, discriminados por medio.

### Movimientos manuales

Se registra un `INGRESO` o `EGRESO`, importe, medio y concepto. Se usa para operaciones reales de caja que no nacen de una venta, cobro o pago. No debe utilizarse para corregir silenciosamente una diferencia de arqueo.

### Arqueo

El efectivo se cuenta por denominacion y cantidad. El sistema calcula subtotales y total declarado y los compara con el efectivo esperado. Se pueden guardar varios arqueos durante una apertura; cada uno conserva usuario, fecha, observacion y detalle, incluso cuando la diferencia es cero.

### Cierre definitivo

Antes de cerrar se revisa el esperado por cada medio y se declara lo contado. El cierre guarda ventas, cobros, pagos, ingresos, egresos, efectivo esperado, efectivo declarado, diferencias, usuario, fecha y observacion. Solo puede existir un cierre definitivo por apertura.

## Historico de cierres

**Historial de cierres** permite revisar como cerro cada punto de venta y caja, con responsable, fechas, cantidad y total de ventas, esperado, declarado y diferencia. El detalle desplegable muestra el control por medio de pago. Los historicos se conservan para auditoria y no dependen de que la caja siga activa.

## Controles recomendados

- Conciliar solo contra documentos del mismo cliente o proveedor.
- Registrar referencias de transferencias, cheques u otros medios.
- Hacer arqueos intermedios sin modificar el esperado.
- Explicar toda diferencia en la observacion del cierre.
- Revisar saldos sin aplicar: pueden representar anticipos reales o conciliaciones pendientes.
- No borrar ni editar datos directamente en PostgreSQL.

Para analizar entradas, salidas y rentabilidad, consultar [Informes y exportacion Excel](informes-y-exportacion-excel.md).
