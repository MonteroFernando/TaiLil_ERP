# Patron tecnico de busquedas en maestros

Las vistas maestras tienen rutas separadas para listado, alta y ficha, pero navegan dentro de la misma pestaña del navegador. Las subsecciones de la ficha se representan como pestañas, mientras que los maestros generales como cuentas agrupadoras conservan una ruta independiente.

El campo de busqueda utiliza una espera breve de 250 ms antes de consultar la API. Esto evita una solicitud por cada pulsacion inmediata y mantiene el filtrado incremental.

En backend, el texto se separa por espacios. Cada termino agrega una condicion `AND`; dentro de ella los campos buscables se combinan con `OR`. Por ejemplo:

```text
(campo_a contiene termino_1 OR campo_b contiene termino_1)
AND
(campo_a contiene termino_2 OR campo_b contiene termino_2)
```

Esto permite coincidencias con palabras desordenadas. La busqueda de articulos usa además una subconsulta `EXISTS` sobre los codigos de barras, evitando duplicar articulos en el resultado.

La busqueda de articulos agrega otra subconsulta `EXISTS` sobre `articulos_proveedores.codigo_proveedor`. De esta forma contempla relaciones multiples sin duplicar filas. El componente web reutilizable `BuscadorArticulo` aplica espera incremental, limita las sugerencias visibles y soporta `ArrowUp`, `ArrowDown`, `Enter` y `Escape`.

Al seleccionar con `Enter`, el componente cierra siempre el desplegable y limpia el estado de sugerencias; no debe quedar visible un panel residual de **Sin coincidencias**. Compras, Stock y otros documentos deben reutilizar este componente en vez de implementar busquedas locales incompletas.

`GET /api/v1/articulos` admite ademas `clasificador_ids` repetible. El filtro utiliza `EXISTS` sobre `articulos_clasificadores` y permite incorporar productos en bloque en documentos como inventarios fisicos.

Por defecto, `GET /api/v1/articulos` excluye articulos con `habilitado = false`. El maestro administrativo utiliza `incluir_inactivos=true` para conservar acceso a sus detalles. Las consultas operativas no deben activar esa opcion.

Los discriminadores tecnicos usados por la API, como `socios.tipo_persona` y `socios_domicilios.tipo`, se conservan en minusculas y estan excluidos de la normalizacion de textos de negocio. Los nombres, direcciones y demas datos visibles continúan almacenandose en mayusculas.
# Acciones y estrategia de eliminación

Las grillas de maestros implementan de forma uniforme las acciones **⚙ Editar** y **Eliminar**. El cliente solicita confirmación antes de invocar el endpoint `DELETE`.

Los endpoints `DELETE` de maestros aplican baja lógica sobre el indicador de estado para preservar integridad referencial, auditoría e historial operativo. En artículos también se deshabilitan las condiciones de venta, compra e inventario. El almacén predeterminado no admite eliminación.
