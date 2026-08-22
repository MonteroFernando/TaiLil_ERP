# Tesoreria, cuentas corrientes, conciliaciones y caja

## Objetivo

Tesoreria concentra el dinero recibido y pagado, las cuentas corrientes de clientes y proveedores, la conciliacion entre documentos y el control completo de cada caja. Se ingresa desde **Panel principal → Tesoreria**.

Los permisos son:

- `tesoreria.ver`: consultar cuentas, documentos, controles e historicos;
- `tesoreria.gestionar`: registrar cobros, pagos, conciliaciones, movimientos, arqueos y cierres.

El perfil **CAJERO** no recibe estos permisos ni accede al modulo completo. Su permiso acotado `ventas.caja.cerrar` muestra el control y cierre de su propia apertura directamente en el POS.

## Flujo practico de una cuenta corriente

Al ingresar en **Cuentas corrientes → Clientes / cobros**, el **Listado general** muestra todos los clientes con deuda o saldo a favor. Se puede buscar por nombre, codigo o documento y filtrar por **con movimientos**, **solamente con deuda**, **solamente saldo a favor** o **todos los clientes**. La cabecera se recalcula sobre el resultado visible: indica cantidad de cuentas agrupadas, posicion neta, limite asignado, credito ocupado, remanente del limite general y anticipos a favor. Al escribir una busqueda, los totales dejan de representar toda la cartera y pasan a representar solamente las filas encontradas.

Cada fila muestra estado de la cuenta, cantidad de documentos pendientes, deuda mas antigua, limite asignado, importe ocupado, porcentaje utilizado, remanente del limite general y saldo a favor. Cuando existen cuentas vinculadas, la deuda y los saldos se presentan consolidados en la cuenta padre para no duplicar los totales. Al abrirla se accede a los documentos de todas sus hijas; al abrir una hija sólo se accede a sus propios documentos.

Una cuenta padre que sólo cumple la función de agrupar se identifica como **AGRUPADORA**, no como **SIN CONFIGURAR**. En sus columnas de límite individual se indica **No aplica** y la columna **Deuda agrupada** muestra el total del grupo. Si la cuenta padre además compra por sí misma, puede configurarse opcionalmente con crédito propio sin modificar los límites de las hijas.

**Ocupado** se mantiene individual en cada cliente, incluso si está vinculado con una cuenta padre. La barra permite reconocer cuánto consume la deuda propia de la hija sobre su límite propio. El disponible operativo de una nueva venta puede ser menor porque el POS también controla el límite del período y la deuda vencida de esa misma hija.

Para clientes, el listado es la unica busqueda necesaria: **Abrir cuenta** presenta una ficha modal sin abandonar ni alargar la pantalla principal. La ficha contiene resumen, documentos con saldo real, registro de cobro, historial y conciliacion. Las ventas ya canceladas no aparecen como pendientes; si no existe deuda, se informa expresamente que no hay documentos donde imputar. El listado puede exportarse a Excel; todos los importes se generan como valores numericos con formato monetario.

**Proveedores / pagos** utiliza el mismo diseño. Su listado general muestra total por pagar, facturas pendientes, deuda mas antigua y pagos confirmados todavia sin aplicar. **Abrir cuenta** presenta el modal del proveedor con facturas y pago, o historial y conciliacion. La busqueda individual inferior ya no se utiliza para ninguno de los dos tipos de cuenta.

Las facturas de proveedor se identifican siempre por **letra + POI + numero** (por ejemplo `A 00003-00001254`). El UUID interno de base de datos no aparece como referencia en pendientes, conciliaciones, historicos, notas de credito, informes ni exportaciones.

Del lado de clientes, cada venta se identifica por su **numero completo de ticket**: letra, punto de venta y numero correlativo (por ejemplo `T 0099-00000015`). En **Historial y conciliacion**, el numero funciona como enlace: al pulsarlo se abre un detalle dentro de Tesoreria con fecha, cliente, punto de venta, caja, articulos, cantidades, lista, precios, descuentos, IVA, total y saldo. El UUID tampoco se presenta como referencia operativa.

1. Elegir **Clientes / cobros** o **Proveedores / pagos**.
2. Buscar por nombre, codigo o documento y seleccionar el socio.
3. Revisar el saldo pendiente y los pagos sin aplicar.
4. En **Documentos y registrar**, indicar cuanto se aplica a cada factura.
5. Registrar el cobro o pago, su medio, referencia y total.
6. Si sobra dinero, queda disponible en el mismo documento para conciliar despues.
7. En **Historial y conciliacion**, revisar lo ya aplicado o distribuir el saldo disponible entre otras facturas.

No es una relacion uno a uno: un cobro o pago puede aplicarse a varias facturas y una factura puede cancelarse con varios cobros o pagos. Una aplicacion parcial puede completarse mas tarde incluso entre el mismo cobro o pago y la misma factura. Cada tramo queda como un renglon historico independiente con importe, fecha y usuario. La suma imputada nunca puede superar el saldo de la factura ni el disponible del documento de pago.

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

### Retirar dinero sin dejar egresos sueltos

**Retirar dinero** obliga a clasificar la salida antes de confirmarla:

- **Gasto directo:** registra un egreso de caja final, con concepto, medio, referencia y proveedor opcional. Se utiliza cuando no existe una factura que deba cancelarse posteriormente.
- **Pago a proveedor:** exige seleccionar al proveedor y crea un pago real asociado a la apertura. Si todavía no se elige ninguna factura, el importe queda como **pago sin aplicar** en la cuenta corriente del proveedor y puede conciliarse posteriormente desde **Cuentas corrientes → Proveedores / pagos**.

Un pago a proveedor no crea simultaneamente un movimiento manual: el propio pago descuenta la caja. Esto evita duplicar la salida en el control, el cierre y el flujo de dinero. Todo retiro conserva fecha y hora, usuario, caja, punto de venta, periodo operativo, medio, concepto y referencia.

Cada apertura pertenece a una **fecha operativa** elegida al abrir la caja. Esa fecha representa el dia comercial y puede ser anterior al instante real de apertura, pero no futura. No es unica: se pueden abrir y cerrar varias cajas o varios turnos dentro del mismo dia operativo. La hora real de cada apertura y cierre se conserva por separado para auditoria. El selector de Caja y arqueo muestra primero el periodo para evitar operar la apertura equivocada.

### Movimientos manuales

Se registra un `INGRESO` o `EGRESO`, importe, medio y concepto. Se usa para operaciones reales de caja que no nacen de una venta, cobro o pago. No debe utilizarse para corregir silenciosamente una diferencia de arqueo.

Para gastos y pagos a proveedores se debe preferir **Retirar dinero**, porque agrega la clasificacion y trazabilidad necesarias. El movimiento manual queda reservado para ajustes operativos excepcionales debidamente explicados.

### Arqueo

El efectivo se cuenta por denominacion y cantidad. El sistema calcula subtotales y total declarado y los compara con el efectivo esperado. Se pueden guardar varios arqueos durante una apertura; cada uno conserva usuario, fecha, observacion y detalle, incluso cuando la diferencia es cero.

### Cierre definitivo

Antes de cerrar se revisa el esperado por cada medio y se declara lo contado. El cierre guarda ventas, cobros, pagos, ingresos, egresos, efectivo esperado, efectivo declarado, diferencias, usuario, fecha y observacion. Solo puede existir un cierre definitivo por apertura.

## Historico de cierres

**Historial de cierres** permite revisar como cerro cada punto de venta y caja, con responsable, fechas, cantidad y total de ventas, esperado, declarado y diferencia. El detalle desplegable muestra el control por medio de pago. Los historicos se conservan para auditoria y no dependen de que la caja siga activa.

La presentacion funciona como un calendario mensual de siete columnas, de lunes a domingo. Cada cambio de mes tiene un encabezado destacado con nombre, año y cantidad de cierres; las celdas vacias conservan la posicion real de los dias. Dentro de cada fecha aparecen todos los cierres de cajas o turnos vinculados al periodo, con resumen compacto y detalle desplegable. Cada tarjeta muestra las horas reales de apertura y cierre. **Filtrar por mes** consulta el intervalo completo del mes seleccionado y **Buscar dia operativo** realiza una busqueda exacta; ambos filtros son excluyentes para evitar resultados ambiguos. **Limpiar filtros** recupera el historial general. En pantallas angostas la cuadricula mantiene su tamaño y se desplaza horizontalmente para no volver ilegibles los importes.

## Controles recomendados

- Conciliar solo contra documentos del mismo cliente o proveedor.
- Registrar referencias de transferencias, cheques u otros medios.
- Hacer arqueos intermedios sin modificar el esperado.
- Explicar toda diferencia en la observacion del cierre.
- Revisar saldos sin aplicar: pueden representar anticipos reales o conciliaciones pendientes.
- No borrar ni editar datos directamente en PostgreSQL.

Para analizar entradas, salidas y rentabilidad, consultar [Informes y exportacion Excel](informes-y-exportacion-excel.md).
