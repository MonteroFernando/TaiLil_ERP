# Informes y exportacion Excel

## Acceso

El modulo **Informes** requiere el permiso `informes.ver`. Un administrador puede otorgarlo o quitarlo desde **Configurar accesos**, independientemente de los permisos de Tesoreria.

El periodo predeterminado comprende los ultimos 30 dias. Los campos **Desde** y **Hasta** incluyen ambos dias.

## Flujo de dinero

Muestra entradas, salidas y flujo neto real, ordenado cronologicamente. Incluye:

- cada medio de los cobros confirmados como entrada;
- cada medio de los pagos confirmados como salida;
- movimientos manuales confirmados de caja segun sean ingreso o egreso.

Una venta a cuenta corriente no es una entrada de dinero hasta que exista un cobro. Del mismo modo, el informe no confunde facturacion con movimiento financiero.

Cada fila del flujo informa fecha y hora, origen, usuario que registro, caja, punto de venta, socio relacionado, medio, concepto, referencia, entrada o salida. **Ver trazabilidad** abre el detalle y un mapa de relacion `Caja → Movimiento → Socio → Comprobantes`. En pagos a proveedores muestra cada factura conciliada y su importe; si el pago continua sin aplicar, lo indica expresamente y permite abrir la cuenta del proveedor para continuar la conciliacion.

Los gastos directos aparecen diferenciados de los pagos a proveedores. Un retiro destinado a proveedor se informa una sola vez como pago, nunca tambien como movimiento manual, evitando duplicar las salidas.

## Ventas y margenes

Funciona como historico de ventas: muestra una fila por comprobante con fecha y hora, numero, cliente, punto de venta, caja, cantidad de articulos distintos, importe original, notas de credito, importe neto, costo historico neto, margen bruto y porcentaje sobre venta. El encabezado de cada columna permite ordenar las filas cargadas.

Puede filtrarse simultaneamente por:

- periodo, con los campos **Desde** y **Hasta**;
- cliente, mediante una busqueda dinamica por nombre, codigo o documento;
- producto, mediante una busqueda dinamica por codigo interno, descripcion, codigo de barras o codigo del proveedor. Las palabras pueden escribirse en cualquier orden.

Al filtrar un producto se muestran las facturas que contienen ese producto. Los importes, costos y margenes siguen correspondiendo a la factura completa, no solamente al renglon encontrado. Los botones **Quitar filtro** permiten volver al listado general sin borrar el periodo.

El listado discrimina las facturas y cada N/C vinculada. Cada fila muestra importe, costo, margen monetario y margen porcentual. Se pueden marcar documentos individualmente, seleccionar todos o quitar la seleccion; el bloque **Rentabilidad combinada de la seleccion** suma sus importes, costos y margenes con signo. La N/C de productos revierte ingreso y costo historico. La N/C narrativa por diferencia de precio revierte ingreso sin inventar una devolucion de costo.

Las notas descuentan tanto el ingreso como el costo de las cantidades devueltas.

El costo es el valor guardado en cada renglon al confirmar la venta. Por eso una modificacion posterior del precio de compra no reescribe el margen historico. El porcentaje se calcula como `margen / venta × 100`; si la venta es cero, se informa cero.

## Informe Excel completo

**Descargar informe completo · Excel** genera un archivo `.xlsx` con:

- **Resumen**: periodo y totales de flujo, ventas, costo y margen;
- **Flujo de dinero**: fecha, sentido, origen, medio, concepto e importe;
- **Ventas y margenes**: fecha y hora, comprobante, cliente, punto de venta, caja, articulos distintos, venta original, notas de credito, importe neto, costo neto, margen y porcentaje.

Los importes se almacenan en las celdas como numeros, con formato monetario; los porcentajes son valores numericos con formato porcentual; las fechas son fechas de Excel. Nunca se exportan importes como texto. Codigos, documentos y comprobantes se mantienen como texto para no perder ceros iniciales.

## Exportacion de listados operativos

El boton general de exportacion aparece como el icono verde de Excel en el encabezado de la pantalla, solamente donde el listado tiene valor administrativo. Ya no utiliza un boton flotante que tape tablas o acciones:

- articulos;
- ultimos documentos de compras;
- proyeccion de stock;
- inventarios;
- historico de movimientos de stock;
- historico de ventas en Tesoreria.

La hoja **Flujo de dinero** del informe completo incorpora usuario, caja, punto de venta, socio, referencia y comprobantes relacionados. Los importes permanecen numericos con formato monetario.

No aparece en formularios, modales, configuraciones, POS, etiquetas ni grillas auxiliares. En particular, las etiquetas no se exportan como tabla.

El archivo refleja las tablas visibles y habilitadas de la pantalla. Para informes gerenciales debe utilizarse siempre el boton de informe completo, que obtiene todo el conjunto preparado por el modulo y no depende de copiar texto de la interfaz.
