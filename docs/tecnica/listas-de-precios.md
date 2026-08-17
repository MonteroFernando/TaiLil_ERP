# Diseño tecnico de listas de precios

La migracion `20260816_0029` crea:

- `listas_precios`, con COMPRAS y GENERAL precargadas;
- `precios_articulos_base`, una fila de precio bruto por articulo;
- `precios_articulos_listas`, con excepciones porcentuales o manuales;
- `reglas_listas_precios_articulos`, con umbrales en unidad base.

El precio comercial efectivo se resuelve desde COMPRAS. Una excepcion manual tiene prioridad; luego una excepcion porcentual; finalmente el porcentaje general de la lista. Los importes utilizan `NUMERIC(18,6)` y los porcentajes `NUMERIC(9,4)`.

Las rutas se agrupan bajo `/api/v1/articulos/precios`. La consulta requiere `ventas.ver` y la configuracion requiere `ventas.gestionar`. `resolver-lista` aplica comparacion estricta `cantidad_minima < cantidad_base` y elige el mayor umbral cumplido.

`POST /api/v1/articulos/precios/actualizar-base` realiza actualizaciones del precio COMPRAS. Acepta un articulo o un clasificador como alcance. El modo `FIJAR` esta limitado a un articulo; `PORCENTAJE` admite ambos alcances y utiliza seis decimales. Para clasificadores se recorre la jerarquia descendente y cada articulo se actualiza una sola vez, aunque posea varias vinculaciones dentro del grupo.
