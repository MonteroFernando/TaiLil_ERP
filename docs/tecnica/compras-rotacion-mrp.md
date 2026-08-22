# Rotacion de compras y MRP simple

## Alcance

La funcionalidad es un analisis de lectura calculado sobre datos transaccionales existentes. No crea tablas, no persiste proyecciones y no requiere migracion Alembic. Las fuentes son `ventas_documentos`, `ventas_documentos_detalles`, `stocks_articulos_almacenes`, `movimientos_stock` y `movimientos_stock_detalles`.

Solo se incluyen articulos activos, habilitados para compra y con control de inventario. La API usa la zona `America/Argentina/Buenos_Aires` para asignar cada operacion a su dia comercial.

## API

`GET /api/v1/articulos/compras/rotacion`

Permiso requerido: `compras.ver`.

Parametros:

- `dias_analisis`: entero de 1 a 365; valor inicial 30.
- `dias_proyeccion`: entero de 1 a 365; valor inicial 15.
- `almacen_id`: UUID opcional. Sin valor, consolida todos los almacenes.

La respuesta `RotacionComprasVista` contiene fechas efectivas, parametros, cantidad global de dias trabajados y una lista de `RotacionCompraArticuloVista`. Los campos cuantitativos son `Decimal`, por lo que permanecen numericos en el contrato y el exportador de Excel los convierte en celdas numericas.

## Reconstruccion de dias con stock

El stock historico se reconstruye sin una foto adicional:

1. se toma el saldo fisico actual por articulo y almacen;
2. se recorren hacia atras los movimientos confirmados incluidos en la ventana y se restaura `saldo_anterior`, obteniendo el saldo al comienzo;
3. se avanza por fecha aplicando `saldo_posterior` de cada movimiento;
4. en un dia trabajado se considera que el articulo tuvo stock si el saldo consolidado fue positivo al iniciar la jornada, si algun movimiento del dia tuvo saldo anterior o posterior positivo, o si existe una venta de ese articulo. Esta ultima regla protege historicos antiguos incompletos y garantiza que una venta valida cuente como disponibilidad operativa.

Los dias trabajados se obtienen de las fechas distintas de ventas confirmadas. Una venta de servicios tambien prueba que el comercio trabajo, aunque el servicio no forme parte de la tabla MRP.

## Calculo

Para cada articulo:

```text
promedio_diario = cantidad_vendida / dias_con_stock
necesidad_proyectada = promedio_diario * dias_proyeccion
disponible = max(stock_fisico - reservado, 0)
sugerencia = max(necesidad_proyectada - disponible - cantidad_pedida, 0)
```

Si no hay dias con stock, el promedio es cero. La salida conserva tres decimales para mediciones; la sugerencia se redondea por exceso a una unidad para articulos no pesables y a 0,001 para pesables. El orden inicial es promedio diario descendente y codigo ascendente como desempate.

## Interfaz

`RotacionCompras.tsx` consume el endpoint desde la pantalla Compras. Los parametros se recalculan al cambiar y tambien cuentan con accion **Calcular**. El filtrado textual se realiza en el cliente con todos los terminos y cualquier orden. `TablaOrdenable` permite reordenar columnas y el atributo `data-exportar-excel="true"` habilita la exportacion general desde el encabezado de la pagina.

El modal de ayuda es informativo, se cierra por boton o al tocar fuera y no usa alertas del navegador.

## Integridad y rendimiento

La operacion es exclusivamente `GET`; no abre transacciones de escritura. El calculo limita ambas ventanas a 365 dias, consulta solo movimientos del periodo y mantiene saldos consolidados por articulo para evitar sumar todos los almacenes en cada dia. Como no hay cambio de esquema, la revision Alembic vigente permanece intacta.
