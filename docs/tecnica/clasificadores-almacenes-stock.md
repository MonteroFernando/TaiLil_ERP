# Diseño tecnico de clasificadores, almacenes y stock

La migracion `20260816_0013` incorpora `clasificadores_articulos`, `articulos_clasificadores`, `almacenes` y `stocks_articulos_almacenes`.

`articulos_clasificadores` implementa una relacion muchos a muchos mediante UUID. `clasificadores_articulos` no posee codigo funcional y conserva los campos `tipo` y `nombre`; `padre_id` es una referencia recursiva que permite profundidad variable. Todos los textos de negocio pasan por la normalizacion general a mayusculas.

`stocks_articulos_almacenes` contiene una unica fila por articulo y almacen. Persiste solamente `cantidad_fisica`, `cantidad_pedida` y `cantidad_reservada`. El fisico admite valores negativos; pedido y reservado se mantienen no negativos. Los valores derivados no se duplican en la base:

```text
cantidad_disponible = cantidad_fisica - cantidad_reservada
cantidad_disponible_futura = cantidad_fisica + cantidad_pedida - cantidad_reservada
```

La API crea filas con valor cero de forma simetrica al dar de alta articulos o almacenes. Un indice unico parcial garantiza que exista como maximo un almacen predeterminado activo.

Rutas principales:

- `GET|POST /api/v1/articulos/clasificadores`
- `PUT /api/v1/articulos/clasificadores/{id}`
- `GET|POST /api/v1/articulos/almacenes`
- `PUT /api/v1/articulos/almacenes/{id}`
- `GET /api/v1/articulos/{id}` incluye el stock calculado por almacen.

La interfaz mantiene la regla de maestros: listado, alta separada y acciones visibles **⚙ Editar** y **Eliminar**. La eliminación es lógica y el almacén predeterminado está protegido. La escritura futura del stock debe efectuarse mediante movimientos transaccionales y no editando directamente la fila de existencia.

## Motor transaccional de stock

La migracion `20260816_0023` incorpora `movimientos_stock` y `movimientos_stock_detalles`. La cabecera identifica el numero secuencial, tipo, estado, almacenes, usuario, fecha, documento de origen y eventual movimiento revertido. El detalle persiste el impacto firmado en unidad base y los saldos fisicos anterior y posterior.

La escritura bloquea mediante `SELECT ... FOR UPDATE` la fila de `stocks_articulos_almacenes` correspondiente. La cabecera, sus detalles y todos los saldos se confirman en la misma transaccion PostgreSQL. No se valida disponibilidad minima: una salida puede producir saldo fisico negativo y queda trazada con sus saldos anterior y posterior.

Una transferencia genera dos detalles por articulo bajo la misma cabecera: cantidad negativa en origen y positiva en destino. Una reversion genera una nueva cabecera `REVERSION`, invierte cada detalle y referencia al movimiento original. La referencia es unica, por lo que un movimiento solo puede revertirse una vez.

Endpoints iniciales:

- `GET /api/v1/articulos/stock/existencias`;
- `GET /api/v1/articulos/stock/movimientos`, filtrable por articulo y almacen para obtener el kardex;
- `POST /api/v1/articulos/stock/ajustes`;
- `POST /api/v1/articulos/stock/transferencias`;

Las consultas requieren `inventario.ver`; los impactos y reversiones requieren `inventario.gestionar`.

Cuando el historial se filtra por articulo o almacen, la cabecera y la subconsulta seleccionan los movimientos coincidentes y la respuesta limita también sus detalles al filtro solicitado. Esto evita mostrar lineas ajenas de un movimiento con multiples productos dentro del kardex puntual.

La migracion `20260816_0025` incorpora `fecha_modificacion` a las cabeceras `movimientos_stock` e `inventarios_stock`. Los registros anteriores se completan respectivamente desde `fecha_confirmacion` y desde la ultima fecha disponible del inventario. Este campo, junto con fecha de creacion/confirmacion, es obligatorio para las futuras tablas transaccionales.

La migracion `20260816_0027` retira la fecha adicional incorporada en `20260816_0026`. El historial muestra una unica fecha y hora operativa por movimiento. El historial central no expone acciones de anulacion: cada modulo debe anular desde el documento original utilizando internamente movimientos compensatorios.

La migracion `20260816_0028` retira también `movimientos_stock.fecha_modificacion`. La unica marca temporal del movimiento es `fecha_confirmacion`, definida funcionalmente como la fecha y hora efectiva de impacto sobre las existencias.

## Inventarios fisicos

La migracion `20260816_0024` crea `inventarios_stock` e `inventarios_stock_detalles`. La cabecera conserva almacen, estado, usuarios de creacion y finalizacion, fechas y el movimiento de ajuste. El detalle conserva el snapshot `cantidad_esperada`, `cantidad_contada` y la observacion explicativa.

La confirmacion bloquea las existencias involucradas con `SELECT ... FOR UPDATE` y compara el saldo actual contra el snapshot. Si existe una diferencia externa, responde `409` sin modificar saldos. Si coincide, calcula `cantidad_contada - cantidad_esperada` y utiliza el mismo motor transaccional de movimientos para confirmar el ajuste.

La migracion `20260821_0038` elimina la restriccion que prohibia detalles con cantidad cero. Al finalizar se persiste un detalle por cada articulo contado, incluso si la diferencia es `0`; esos detalles son evidencia de control y no cambian el saldo. La misma version habilita el alta con stock inicial: `POST /api/v1/articulos` crea una cabecera `STOCK_INICIAL` y sus impactos positivos dentro de la transaccion de alta. La lista de almacenes del payload debe ser unica y solo se acepta si el articulo controla inventario.

`GET /api/v1/articulos/stock/movimientos` ordena por `fecha_confirmacion` y numero en forma ascendente. Este orden cronologico se conserva en el frontend y en la exportacion Excel.

Endpoints:

- `GET|POST /api/v1/articulos/stock/inventarios`;
- `DELETE /api/v1/articulos/stock/inventarios/{id}` elimina cabecera y detalles solamente si el documento esta pendiente y no posee cantidades contadas;
- `GET /api/v1/articulos/stock/inventarios/{id}`;
- `PUT /api/v1/articulos/stock/inventarios/{id}/conteo`;
- `POST /api/v1/articulos/stock/inventarios/{id}/finalizar`.
