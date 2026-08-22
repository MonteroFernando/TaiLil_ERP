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

Acepta `desde`, `hasta`, `cliente_id` y `limite` entre 1 y 1000, predeterminado 500. Solo incluye ventas confirmadas y ordena ascendentemente por fecha.

El costo se calcula con `cantidad_base × costo_unitario_bruto` almacenado en cada detalle. La migracion `20260821_0039` agrega ese costo historico y completa ventas existentes con la mejor referencia disponible. Las notas confirmadas se restan de la venta y sus cantidades se valorizan con el mismo costo historico para obtener costo y margen netos.

`margen_bruto = venta_bruta - costo_bruto`.

`margen_porcentual = margen_bruto / venta_bruta × 100`, o cero cuando la venta es cero.

## Permiso

La migracion `20260821_0040` crea `informes.ver`. Para conservar continuidad, lo asigna inicialmente a perfiles que ya tenian `tesoreria.ver`; luego ambos permisos son administrables por separado. Los administradores tienen acceso total por diseño.

## Generacion XLSX

`apps/web/src/components/ExportarExcel.tsx` usa ExcelJS. `descargarLibroExcel` crea libros con encabezado, autofiltro, primera fila congelada, anchos ajustados y nombres de hoja validos.

Los tipos se conservan explicitamente:

- moneda: `number` y formato `"$"#,##0.00;[Red]-"$"#,##0.00`;
- porcentaje: decimal real (`25 %` se guarda como `0.25`) y formato `0.00%`;
- fechas: objetos `Date` y formato `dd/mm/yyyy hh:mm`;
- cantidades: enteros o decimales numericos;
- codigos, documentos, referencias y comprobantes: texto para conservar ceros.

`monedaExcel` y `porcentajeExcel` convierten las cadenas JSON decimales a numeros antes de escribir la celda. Los importes no se exportan como cadenas.

## Seleccion de tablas

El exportador general solo toma tablas visibles con `data-exportar-excel="true"`. Es un mecanismo opt-in: agregar una tabla a una pantalla no la vuelve exportable automaticamente. Actualmente se habilitan articulos, ultimos documentos de compras, proyeccion e historicos de stock, inventarios e historico de ventas de Tesoreria. POS, Etiquetas, formularios, configuraciones y modales quedan excluidos.

Informes genera un libro dedicado de tres hojas —Resumen, Flujo de dinero y Ventas y margenes— directamente desde los datos de sus APIs.
