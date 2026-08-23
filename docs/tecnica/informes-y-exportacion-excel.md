# Informes y exportacion Excel

## Informes API

El router `/api/v1/informes` protege todas las rutas con `informes.ver`.

### `GET /informes/flujo-dinero`

Parametros opcionales `desde` y `hasta` en formato `YYYY-MM-DD`; ambos extremos son inclusivos. Sin parametros utiliza los ultimos 30 dias.

Une conceptualmente:

- `cobros_documentos` + sus medios confirmados como `INGRESO`;
- `pagos_documentos` + sus medios confirmados como `EGRESO`;
- `movimientos_caja` confirmados con su sentido original.

Devuelve totales de ingresos, egresos, flujo neto y filas ordenadas por fecha. Una fila se genera por medio, por lo que un documento mixto queda correctamente discriminado.

### `GET /informes/ventas-margenes`

Acepta `desde`, `hasta`, `cliente_id`, `articulo_id` y `limite` entre 1 y 1000, predeterminado 500. Solo incluye ventas confirmadas y ordena ascendentemente por fecha. Cada fila incorpora fecha y hora, comprobante, cliente, punto de venta, caja y cantidad de articulos distintos, ademas de sus importes y margenes.

El filtro por producto se implementa mediante un `EXISTS` correlacionado sobre el detalle. De esta manera selecciona las facturas que contienen el articulo sin recortar el `JOIN` usado para totalizar sus costos: venta, costo y margen siempre representan la factura completa. Los `LEFT JOIN` de punto de venta y caja conservan documentos historicos que no tengan esas referencias.

La respuesta tambien contiene `documentos`, una secuencia cronologica con filas firmadas de tipo `FACTURA` y `NOTA_CREDITO`. Cada fila incluye `margen_porcentual`; cada nota informa `documento_origen`, modalidad y motivo. La interfaz calcula la rentabilidad combinada de los identificadores seleccionados; las facturas suman y las notas restan. Para una nota narrativa el costo firmado es cero.

El costo se calcula con `cantidad_base × costo_unitario_bruto` almacenado en cada detalle. La migracion `20260821_0039` agrega ese costo historico y completa ventas existentes con la mejor referencia disponible. Las notas confirmadas se restan de la venta y sus cantidades se valorizan con el mismo costo historico para obtener costo y margen netos.

`margen_bruto = venta_bruta - costo_bruto`.

`margen_porcentual = margen_bruto / venta_bruta × 100`, o cero cuando la venta es cero.

### Filtros dinamicos

`GET /informes/filtros/clientes` busca clientes activos por codigo, razon social, nombre de fantasia o documento.

`GET /informes/filtros/articulos` busca articulos activos por codigo interno, descripcion, descripcion ampliada, codigo de barras activo o codigo de proveedor activo. Cada palabra ingresada debe aparecer en alguno de esos campos, por lo que el orden de las palabras no afecta la busqueda.

Ambos endpoints devuelven hasta 20 opciones livianas y exigen `informes.ver`; no requieren otorgar permisos del maestro de datos a quien solamente consulta informes.

## Permiso

La migracion `20260821_0040` crea `informes.ver`. Para conservar continuidad, lo asigna inicialmente a perfiles que ya tenian `tesoreria.ver`; luego ambos permisos son administrables por separado. Los administradores tienen acceso total por diseño.

## Generacion XLSX

`apps/web/src/components/ExportarExcel.tsx` usa ExcelJS. `descargarLibroExcel` crea libros con titulo, subtitulo, metadatos, encabezado de tabla, autofiltro, paneles congelados, anchos ajustados y nombres de hoja validos.

Los tipos se conservan explicitamente:

- moneda: `number` y formato `"$"#,##0.00;[Red]-"$"#,##0.00`;
- porcentaje: decimal real (`25 %` se guarda como `0.25`) y formato `0.00%`;
- fechas: objetos `Date` y formato `dd/mm/yyyy hh:mm`;
- cantidades: enteros o decimales numericos;
- codigos, documentos, referencias y comprobantes: texto para conservar ceros.

`monedaExcel` y `porcentajeExcel` convierten las cadenas JSON decimales a numeros antes de escribir la celda. Los importes no se exportan como cadenas.

## Seleccion de tablas

El exportador general inspecciona el contenido visible de cada modulo y monta mediante portal un boton con icono de Excel en su encabezado principal. Genera una hoja **Vista general** con titulo, subtitulo, fecha de exportacion, filtros/campos e indicadores visibles, mas una hoja por cada tabla visible. Las filas completas se toman del DOM aunque exista desplazamiento horizontal o vertical; se omiten columnas vacias o de acciones. Las tablas de lineas que el usuario haya desplegado debajo de un comprobante se exportan como hojas separadas. Una pantalla con exportador dedicado, como Informes, reemplaza al exportador general para evitar duplicados.

## Trazabilidad del flujo

`GET /api/v1/informes/flujo-dinero` enriquece cobros, pagos y movimientos de caja con identificador, tipo de origen, usuario, apertura, caja, punto de venta, periodo operativo, socio, categoria, referencia y `relaciones`. Las relaciones activas se obtienen de `imputaciones_cobros_ventas` o `imputaciones_pagos_facturas` y contienen UUID, comprobante e importe aplicado.

La API carga usuarios, contextos de caja, socios y relaciones en consultas agrupadas para evitar una consulta por cada fila. El frontend representa esos datos en un modal con mapa de relacion y enlace a la cuenta corriente correspondiente. La exportacion completa agrega las mismas columnas y serializa los importes relacionados como texto descriptivo, manteniendo la columna principal de importe como valor monetario numerico.

## Ordenamiento interactivo

`apps/web/src/components/TablaOrdenable.tsx` centraliza el ordenamiento de los listados extensos. Conserva un orden estable y aplica un ciclo ascendente, descendente y original al pulsar cada encabezado. El comparador reconoce fechas localizadas `es-AR`, numeros con separadores de miles, decimales, moneda y porcentajes; para texto utiliza `Intl.Collator` con comparacion numerica de codigos.

El componente ordena las filas actualmente cargadas y filtradas en el navegador. El exportador obtiene el mismo orden que se ve en pantalla. Las columnas de acciones y las grillas transaccionales con campos editables no se ordenan.

Informes genera un libro dedicado de tres hojas —Resumen, Flujo de dinero y Ventas y margenes— directamente desde los datos de sus APIs. Cada hoja incorpora el rango y los filtros activos; Resumen tambien incluye los importes de la rentabilidad combinada seleccionada.
