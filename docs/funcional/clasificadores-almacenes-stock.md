# Clasificadores, almacenes y stock

## Clasificacion de articulos

Los articulos pueden vincularse con varios clasificadores. Cada clasificador posee **tipo**, **nombre**, un clasificador padre opcional y estado. El tipo define el criterio (por ejemplo, `RUBRO`) y el nombre define su valor (por ejemplo, `FIAMBRES`). No solicita codigo: las relaciones utilizan el identificador interno de la base.

Dentro de los detalles del articulo, los clasificadores pueden buscarse por tipo o nombre. La seleccion respeta la jerarquia: al elegir un clasificador padre aparecen automaticamente sus clasificadores vinculados; al retirar el padre se retiran tambien sus descendientes seleccionados.

El alta se abre desde **Nuevo clasificador** y cada fila ofrece **⚙ Editar** y **Eliminar**. Eliminar desactiva el clasificador: permanece en el historial, pero deja de ofrecerse para nuevas asignaciones.

## Almacenes

Existe un almacen predeterminado denominado `ALMACEN PRINCIPAL` con codigo `ALM001`. Se pueden crear otros almacenes indicando codigo, descripcion y una ubicacion opcional. Solamente un almacen puede ser predeterminado.

Cuando se crea un articulo, el sistema genera automáticamente su existencia inicial en cero para todos los almacenes activos. Cuando se crea un almacen, genera en cero la existencia de todos los articulos ya registrados.

Durante el alta de un producto habilitado para inventario se puede indicar el **stock inicial por almacen**. Las cantidades positivas generan un movimiento confirmado `STOCK_INICIAL`, con usuario, fecha y saldos anterior/posterior. No se permite repetir el mismo almacen. Los servicios y los articulos sin control de inventario no admiten stock inicial. Una correccion posterior se realiza con ajuste o inventario, nunca editando el saldo inicial.

## Control e historial de stock

El modulo **Stock** agrupa el control de existencias, articulos, clasificadores y almacenes. La pantalla **Control de stock** permite consultar existencias, registrar ajustes manuales, efectuar transferencias entre almacenes y revisar el historial.

Cada movimiento confirmado registra el usuario, fecha y hora, tipo, observacion, articulo, almacen, cantidad, saldo anterior y saldo posterior. Un movimiento confirmado no se modifica ni se elimina. El historial es exclusivamente de consulta. Si un documento fue incorrecto, se anula desde su propia ficha y el documento original genera los impactos compensatorios.

El historial funciona como kardex: inicialmente no lista todos los movimientos. Primero se busca y selecciona un producto; luego se muestran solamente sus impactos, indicando claramente si cada linea fue una **ENTRADA** o **SALIDA**, el tipo de operacion, motivo, almacen, cantidad y cambio entre stock anterior y posterior.

El kardex permite filtrar adicionalmente por almacen y siempre se ordena de forma **ascendente**, desde la fecha y hora mas antigua hacia la mas nueva. Cada movimiento guarda una unica fecha y hora: el momento exacto en que impacto el stock. Cada fila respeta el orden de lectura: **fecha y hora de impacto**, **operacion realizada**, **numero de transaccion**, usuario, motivo e impactos.

Los ajustes admiten cantidades positivas para entradas y negativas para salidas. El stock fisico puede quedar negativo: representa unidades vendidas o retiradas que todavia no fueron regularizadas y no bloquea la operacion. Las transferencias descuentan el almacen de origen y suman el almacen de destino dentro de una unica operacion.

Las existencias muestran:

- fisico: unidades realmente presentes;
- pedido: unidades solicitadas todavia no recibidas;
- reservado: unidades comprometidas;
- disponible: `fisico - reservado`;
- disponible futuro: `fisico + pedido - reservado`.

Disponible y disponible futuro se calculan al consultar y no se guardan como saldos independientes.

La consulta permite ver **Todos los almacenes** o elegir uno particular. El articulo se localiza mediante el buscador general por descripcion, codigo interno, cualquiera de sus barras o cualquiera de sus codigos de proveedor.

## Inventarios fisicos

La pestaña **Inventarios** permite elegir un almacen y seleccionar los productos que participaran del conteo. Cada inventario queda numerado y guardado con estado `PENDIENTE` o `FINALIZADO`, usuario, fechas y una observacion general opcional.

Los productos pueden agregarse individualmente con el buscador general o incorporarse en bloque seleccionando un clasificador, por ejemplo `RUBRO: FIAMBRES`. Los productos incorporados se muestran debajo en una planilla compacta con desplazamiento; desde alli se pueden quitar individualmente antes de crear el inventario.

La opcion **Contar todos los articulos** incorpora de una vez todos los productos activos que controlan inventario. Un inventario pendiente puede eliminarse solamente mientras ninguna de sus lineas tenga una cantidad contada guardada.

Desde su ficha se puede imprimir una planilla de conteo. La version impresa no muestra la existencia esperada para evitar condicionar al responsable; contiene codigo, descripcion y espacios para cantidad, observacion, responsable y firma.

La carga digital muestra por producto la existencia esperada, cantidad contada y diferencia. Cada linea admite una observacion opcional para explicar faltantes, sobrantes, roturas u otras causas. El conteo puede guardarse parcialmente y retomarse.

La grilla de conteo permanece debajo de la cabecera y utiliza desplazamiento interno para que un inventario con muchos productos no aumente indefinidamente el alto de la pantalla.

Al finalizar deben estar contados todos los productos. El sistema muestra y confirma los ajustes necesarios, genera un movimiento `AJUSTE_INVENTARIO` y vincula el movimiento con el inventario. El documento finalizado conserva para siempre los valores y explicaciones cargados.

Las lineas cuya diferencia es `0` tambien se guardan dentro del movimiento. No alteran la existencia, pero prueban que el producto fue contado y estaba correcto en esa fecha y hora.

Si el stock de alguno de los productos cambia mientras el inventario permanece pendiente, la finalizacion se bloquea para impedir que un conteo desactualizado sobrescriba movimientos posteriores. En ese caso se debe iniciar un nuevo inventario.

## Cantidades de stock

- **Fisico:** existencia real recibida; no descuenta reservas ni incorpora pedidos.
- **Pedido:** mercaderia solicitada que todavia no ingreso fisicamente.
- **Reservado:** existencia comprometida para una salida.
- **Disponible:** `fisico - reservado`.
- **Disponible futuro:** `fisico + pedido - reservado`.

Las cantidades se modifican exclusivamente mediante documentos confirmados de ingreso, venta, ajuste, transferencia, stock inicial o inventario. Nunca se edita directamente una existencia.
