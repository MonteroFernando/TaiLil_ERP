# Maestro de articulos

## Normalizacion transversal

Un evento `before_flush` de SQLAlchemy normaliza con `strip().upper()` todos los campos de texto de negocio antes de persistirlos. La regla se aplica tambien a futuros modulos. Se excluyen contrasenas, hashes, tokens, datos de sesion y discriminadores tecnicos cuyo valor forma parte de un contrato interno.

Los nombres de usuario se almacenan en mayusculas y el inicio de sesion normaliza el valor recibido antes de buscarlo, por lo que el acceso no depende de como se escriban las letras.

## Tablas

```text
articulos
  ├── articulos_unidades
  ├── articulos_codigos_barra
  └── articulos_proveedores ── proveedores

articulos ── unidades_medida
```

`articulos.id` es la clave tecnica UUID. Para `tipo_articulo=producto`, `articulos.codigo` se genera mediante la secuencia PostgreSQL `secuencia_codigo_articulos` con cinco digitos (`00001` a `99999`).

Para `tipo_articulo=servicio`, el codigo es alfanumerico, se normaliza a mayusculas y debe contener al menos una letra. Los servicios no controlan inventario ni admiten la marca de pesable.

## Alicuota de IVA

`articulos.alicuota_iva_id` referencia obligatoriamente el catalogo `alicuotas_iva`. La migracion inicial carga las tasas 0%, 10,5%, 21% y 27%, y asigna 21% a los registros anteriores.

## Conversion de unidades

`articulos_unidades.factor_a_base` expresa cuantas unidades base contiene una presentacion. Al crear un articulo se genera automaticamente una presentacion base con factor `1`.

La unidad base no puede modificarse mediante la API después del alta. Cambiarla cuando existan movimientos requerira un caso de uso controlado que convierta o preserve las cantidades historicas.

### Unidad alternativa

`articulos_unidades.es_unidad_alternativa` identifica la presentacion que pueden usar distintos documentos cuando el usuario activa el modo de unidad alternativa. Una restriccion unica parcial de PostgreSQL sobre `articulo_id` cuando el valor es verdadero impide que existan dos seleccionadas para el mismo articulo. La unidad base nunca es alternativa y el alta comienza sin una seleccion.

Los futuros movimientos de entrada y salida deben convertir la cantidad mediante `cantidad_movimiento * factor_a_base`; el stock se conserva en la unidad base.

## Resolucion de codigos de barras

`articulos_codigos_barra.modo_contenido` acepta:

- `cantidad`: utiliza el campo `cantidad` y no admite una presentacion vinculada.
- `unidad`: requiere `articulo_unidad_id` y utiliza su `factor_a_base`.

Una restriccion de base garantiza la coherencia entre el modo y la presentacion. La API devuelve `cantidad_base_resuelta` para que punto de venta e inventario no tengan que repetir la regla.

## Productos pesables

`es_pesable=true` exige una unidad base que admita decimales. La decodificacion de etiquetas de balanza se implementara como una estrategia separada cuando se construya el punto de venta.

## API

```text
GET  /api/v1/articulos
POST /api/v1/articulos
GET  /api/v1/articulos/{id}
PUT  /api/v1/articulos/{id}
GET  /api/v1/articulos/unidades-medida
GET  /api/v1/articulos/alicuotas-iva
PUT  /api/v1/articulos/{id}/alicuota-iva
POST /api/v1/articulos/{id}/unidades
PUT  /api/v1/articulos/{id}/unidades/{unidad_id}
DELETE /api/v1/articulos/{id}/unidades/{unidad_id}
POST /api/v1/articulos/{id}/unidades/{unidad_id}/alternativa
POST /api/v1/articulos/{id}/codigos-barra
PUT  /api/v1/articulos/{id}/codigos-barra/{codigo_id}
DELETE /api/v1/articulos/{id}/codigos-barra/{codigo_id}
GET  /api/v1/articulos/proveedores
POST /api/v1/articulos/proveedores
POST /api/v1/articulos/{id}/proveedores
PUT  /api/v1/articulos/{id}/proveedores/{relacion_id}
DELETE /api/v1/articulos/{id}/proveedores/{relacion_id}
```

Las consultas requieren `datos_maestros.ver`; las modificaciones requieren `datos_maestros.gestionar`. Los administradores siempre superan esta comprobacion.

`POST /api/v1/articulos` admite `stock_inicial: [{almacen_id, cantidad}]`. El esquema rechaza almacenes repetidos y stock para servicios o articulos sin inventario. Si hay cantidades positivas, el alta crea y confirma un movimiento `STOCK_INICIAL` con sus detalles y existencias dentro de la misma transaccion.
