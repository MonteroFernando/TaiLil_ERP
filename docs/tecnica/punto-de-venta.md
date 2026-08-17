# Punto de venta

## Modelo transaccional

La migracion `20260816_0030` incorpora:

- `ventas_documentos` y `ventas_documentos_detalles` para cabecera y lineas comerciales.
- `cobros_documentos` y `cobros_medios_pago` para el documento financiero y sus medios combinados.
- `imputaciones_cobros_ventas` como relacion entre cobros y ventas.
- `secuencia_ventas` y `secuencia_cobros` para numeracion interna independiente.

La migracion `20260816_0032` incorpora el socio cliente tecnico `CONSUMIDOR_FINAL`. `cliente_id` es opcional solamente en la solicitud del POS; antes de persistir, el backend lo reemplaza por este socio, por lo que la relacion almacenada en `ventas_documentos` continua siendo obligatoria.

La relacion de imputaciones es conceptualmente muchos a muchos. La restriccion unica evita repetir el mismo par cobro-venta; los futuros procesos de cobranza podran distribuir un cobro entre varias ventas.

La migracion `20260817_0033` agrega `puntos_venta`, `cajas_ventas`, `aperturas_cajas` y `reimpresiones_ventas`. Extiende la cabecera con punto, caja, apertura, letra, tipo documental, numero anulable y fecha de modificacion. La restriccion unica definitiva es `(punto_venta_id, letra, numero)`.

Dos indices parciales de PostgreSQL impiden más de una apertura `ABIERTA` por caja o por usuario. Los registros anteriores se vinculan al punto inicial `0001`; su mayor numero alimenta `ultimo_numero` para continuar sin colisiones.

## API

- `GET /api/v1/articulos/pos/precio` resuelve el precio operativo para una cantidad.
- `POST /api/v1/articulos/pos/ventas` confirma una venta POS.
- La confirmacion y el guardado automatico capturan los errores de red. El flujo restablece siempre sus indicadores de proceso para evitar promesas rechazadas sin manejar y permitir un nuevo intento.
- La migracion `20260817_0034` elimina la restriccion PostgreSQL `stock_fisico_no_negativo`. El POS puede confirmar salidas superiores a la existencia y conserva el saldo fisico negativo en el historial.
- La confirmacion normaliza pagos y saldo a dos decimales. Si queda una diferencia positiva maxima de `0.01`, se ajusta el ultimo medio de pago; las diferencias mayores conservan el saldo y la respuesta de rechazo informa total, pagado y saldo calculados por el servidor.
- `GET /api/v1/articulos/pos/ventas` lista las ultimas ventas y admite filtro por cliente.
- `GET /api/v1/articulos/pos/ventas/{id}` devuelve el detalle.
- `GET/POST /api/v1/articulos/pos/configuracion/puntos-venta` consulta o crea puntos.
- `GET/POST /api/v1/articulos/pos/configuracion/cajas` consulta o crea cajas.
- `GET /api/v1/articulos/pos/cajas/abiertas` recupera aperturas visibles.
- `POST /api/v1/articulos/pos/cajas/abrir` abre una caja con efectivo inicial.
- `GET/POST /api/v1/articulos/pos/borradores` consulta o persiste borradores.
- `DELETE /api/v1/articulos/pos/borradores/{id}` elimina un borrador sin impacto.
- `GET /api/v1/articulos/pos/ventas/{id}/imprimir?formato=ticket|a4` genera la vista imprimible y registra la impresión.

La API recalcula precios, lista aplicable, neto e IVA; no acepta importes comerciales calculados por el frontend. Requiere `ventas.gestionar` para confirmar y `ventas.ver` para consultar.

## Atomicidad e inventario

La confirmacion usa una unica transaccion de base de datos. Dentro de ella se validan cliente, almacen, articulos, precios, pagos y credito. Los articulos inventariables generan un movimiento `PRESUPUESTO` con cantidad negativa; los servicios no impactan stock. La disponibilidad no es una restriccion y el saldo fisico posterior puede ser negativo.

Con la numeracion por punto, la confirmacion bloquea la fila de `puntos_venta` mediante `SELECT ... FOR UPDATE`, incrementa `ultimo_numero` y transforma el borrador en `CONFIRMADO`. El movimiento se denomina `PRESUPUESTO` y referencia `T punto-numero`. La impresión es una consulta posterior y nunca ejecuta lógica contable o de inventario.

## Credito

Cuando el total pagado es menor al total bruto se valida `cuentas_corrientes_ventas`: estado activo, deuda maxima, limite del periodo y vencimiento de la deuda mas antigua. El saldo inicial de la venta es el importe que no fue cubierto por el cobro creado en el POS.

## Alcance fiscal

Los documentos son internos y no representan comprobantes fiscales. No existe todavia integracion con factura electronica, ARCA, CAE, puntos de venta fiscales ni numeracion fiscal.

## Operacion por teclado

El frontend registra `F2` a nivel de ventana y dirige el foco al buscador operativo de articulos, incluso si el foco estaba en otro control. La seleccion por `Enter` conserva el foco en el buscador; `Tab` sigue el orden natural del DOM hacia la cantidad. El campo usa paso entero para articulos comunes y paso decimal para pesables; `Enter` desde cantidad devuelve el foco al buscador. `F10` abre el cobro global y `Escape` lo cierra.

El buscador interpreta opcionalmente el prefijo `cantidad*` y envia al POS el articulo junto con el multiplicador. El POS agrupa por identificador de articulo: una seleccion repetida acumula cantidad en la linea existente y vuelve a resolver la escala de precios.
El total general del frontend se deriva directamente de `cantidad * precio` para cada linea. El subtotal almacenado en el estado no se utiliza como fuente del cobro, evitando divergencias al crear por primera vez una linea con multiplicador.
