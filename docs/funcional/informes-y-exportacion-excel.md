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

## Ventas y margenes

Muestra por comprobante la venta original, notas de credito, venta neta, costo historico neto, margen bruto y porcentaje sobre venta. Puede filtrarse por cliente buscando por nombre, codigo o documento. Las notas descuentan tanto el ingreso como el costo de las cantidades devueltas.

El costo es el valor guardado en cada renglon al confirmar la venta. Por eso una modificacion posterior del precio de compra no reescribe el margen historico. El porcentaje se calcula como `margen / venta × 100`; si la venta es cero, se informa cero.

## Informe Excel completo

**Descargar informe completo · Excel** genera un archivo `.xlsx` con:

- **Resumen**: periodo y totales de flujo, ventas, costo y margen;
- **Flujo de dinero**: fecha, sentido, origen, medio, concepto e importe;
- **Ventas y margenes**: fecha, comprobante, cliente, venta original, notas de credito, venta neta, costo neto, margen y porcentaje.

Los importes se almacenan en las celdas como numeros, con formato monetario; los porcentajes son valores numericos con formato porcentual; las fechas son fechas de Excel. Nunca se exportan importes como texto. Codigos, documentos y comprobantes se mantienen como texto para no perder ceros iniciales.

## Exportacion de listados operativos

El boton general **Exportar listado · Excel** aparece solamente donde el listado tiene valor administrativo:

- articulos;
- ultimos documentos de compras;
- proyeccion de stock;
- inventarios;
- historico de movimientos de stock;
- historico de ventas en Tesoreria.

No aparece en formularios, modales, configuraciones, POS, etiquetas ni grillas auxiliares. En particular, las etiquetas no se exportan como tabla.

El archivo refleja las tablas visibles y habilitadas de la pantalla. Para informes gerenciales debe utilizarse siempre el boton de informe completo, que obtiene todo el conjunto preparado por el modulo y no depende de copiar texto de la interfaz.
