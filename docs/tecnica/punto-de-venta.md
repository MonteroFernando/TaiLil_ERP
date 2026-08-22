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
- La confirmacion normaliza todos los importes a dos decimales. `CUENTA_CORRIENTE` forma parte del contrato de entrada, admite una sola linea y debe coincidir exactamente con el remanente posterior a pagos reales y saldo a favor. El backend rechaza medios vacios, diferencias y cualquier deuda implicita.
- `GET /api/v1/articulos/pos/ventas` lista las ultimas ventas y admite filtro por cliente.
- `GET /api/v1/articulos/pos/ventas/{id}` devuelve el detalle.
- `GET/POST /api/v1/articulos/pos/configuracion/puntos-venta` consulta o crea puntos.
- `GET/POST /api/v1/articulos/pos/configuracion/cajas` consulta o crea cajas.
- `PATCH /api/v1/articulos/pos/configuracion/puntos-venta/{id}` y `/cajas/{id}` modifican solamente la descripcion.
- `DELETE /api/v1/articulos/pos/configuracion/puntos-venta/{id}` elimina punto y cajas unicamente sin numeracion, aperturas ni ventas; `DELETE .../cajas/{id}` exige que la caja no tenga aperturas ni ventas. La API responde `409` si existe historia.
- `GET /api/v1/articulos/pos/cajas/abiertas` recupera aperturas visibles.
- `POST /api/v1/articulos/pos/cajas/abrir` abre una caja con efectivo inicial.
- `GET/POST /api/v1/articulos/pos/borradores` consulta o persiste borradores.
- `DELETE /api/v1/articulos/pos/borradores/{id}` elimina un borrador sin impacto.
- `GET /api/v1/articulos/pos/ventas/{id}/imprimir?formato=ticket|a4&automatico=true|false` genera la vista imprimible y registra la impresion. Con `automatico=true`, invoca `window.print()` al cargar y cierra la ventana despues del trabajo.

La API recalcula precios, lista aplicable, neto e IVA; no acepta importes comerciales calculados por el frontend. Los accesos generales conservan `ventas.gestionar` para confirmar y `ventas.ver` para consultar. El perfil acotado usa `ventas.caja.operar` solamente en los endpoints indispensables del POS.

`GET /api/v1/articulos/pos/precio` devuelve un contrato comercial reducido: lista aplicada, precio de venta y, cuando corresponde, precio anterior. Nunca serializa `precio_base_bruto` ni el costo COMPRAS. El cierre integrado usa `GET /api/v1/tesoreria/cajas/{apertura_id}/control` y `POST /api/v1/tesoreria/cajas/{apertura_id}/cerrar`, autorizados por `ventas.caja.cerrar` o los permisos generales de Tesoreria. Para usuarios no administradores ambos endpoints validan que la apertura pertenezca al usuario autenticado.

## Atomicidad e inventario

La confirmacion usa una unica transaccion de base de datos. Dentro de ella se validan cliente, almacen, articulos, precios, pagos y credito. Los articulos inventariables generan un movimiento `PRESUPUESTO` con cantidad negativa; los servicios no impactan stock. La disponibilidad no es una restriccion y el saldo fisico posterior puede ser negativo.

Con la numeracion por punto, la confirmacion bloquea la fila de `puntos_venta` mediante `SELECT ... FOR UPDATE`, incrementa `ultimo_numero` y transforma el borrador en `CONFIRMADO`. El movimiento se denomina `PRESUPUESTO` y referencia `T punto-numero`. La impresión es una consulta posterior y nunca ejecuta lógica contable o de inventario.

## Credito

Cuando el total pagado es menor al total bruto, el backend bloquea los cobros confirmados del cliente y prepara imputaciones sobre su saldo no aplicado, comenzando por los mas antiguos. El remanente debe estar declarado como `CUENTA_CORRIENTE`; si falta o difiere, la transaccion se rechaza. Ese importe no se persiste en `cobros_medios_pago` ni suma a la caja: se conserva como `ventas_documentos.saldo_pendiente` y se valida contra `cuentas_corrientes_ventas`: estado activo, deuda maxima, limite del periodo y vencimiento de la deuda mas antigua.

`GET /api/v1/articulos/socios/{id}/cuenta-corriente-ventas` devuelve tambien `deuda_actual`, `consumo_periodo`, `credito_disponible`, `saldo_favor`, `disponible_total` y `deuda_vencida`. El credito operativo es el menor valor entre el remanente del limite total y el remanente del periodo; queda en cero si la cuenta esta inactiva o tiene deuda vencida. `saldo_favor` suma cobros confirmados menos imputaciones activas y permanece utilizable en esos casos. `disponible_total` es la suma de ambos conceptos.

Las imputaciones de anticipos y la venta se confirman en la misma transaccion. `SELECT ... FOR UPDATE` sobre los cobros evita que dos cajas consuman el mismo saldo. El ticket toma el importe de cada imputacion, no el total original del cobro, para no presentar un anticipo parcial como si se hubiese cobrado nuevamente en el POS.

## Alcance fiscal

Los documentos son internos y no representan comprobantes fiscales. No existe todavia integracion con factura electronica, ARCA, CAE, puntos de venta fiscales ni numeracion fiscal.

## Operacion por teclado

El layout de escritorio usa una grilla `minmax(0, 1fr) / 370px` dentro de la altura visible. El panel de lineas posee `overflow: auto` y cabecera `sticky`; el panel lateral tiene desplazamiento independiente y mantiene sticky la tarjeta de total. En resoluciones inferiores al breakpoint `xl`, el documento recupera flujo vertical y el resumen se ordena antes del detalle para conservar accesibilidad.

El frontend registra `F2` a nivel de ventana y dirige el foco al buscador operativo de articulos, incluso si el foco estaba en otro control. La seleccion por `Enter` conserva el foco en el buscador; `Tab` sigue el orden natural del DOM hacia la cantidad. El campo usa paso entero para articulos comunes y paso decimal para pesables; `Enter` desde cantidad devuelve el foco al buscador. `F10` abre el cobro global y `Escape` lo cierra.

`BuscadorArticulo` usa `seleccionarDirectoConEnter`: un codigo de barra exacto se resuelve y agrega con el Enter del lector. `F3` abre un dialogo React con la misma busqueda; consulta endpoints comerciales protegidos por `ventas.ver` o `ventas.caja.operar`. La respuesta expone precios comerciales resueltos y no incluye el costo base COMPRAS.

El buscador interpreta opcionalmente el prefijo `cantidad*` y envia al POS el articulo junto con el multiplicador. El POS agrupa por identificador de articulo: una seleccion repetida acumula cantidad en la linea existente y vuelve a resolver la escala de precios.
El total general del frontend se deriva directamente de `cantidad * precio` para cada linea. El subtotal almacenado en el estado no se utiliza como fuente del cobro, evitando divergencias al crear por primera vez una linea con multiplicador.

## Impresion directa

El componente compartido `SelectorModoImpresion` persiste `VISTA_PREVIA` o `DIRECTA` en `localStorage`. Al confirmar una venta en modo directo, el POS abre previamente una ventana dentro del gesto del usuario para evitar el bloqueo de ventanas emergentes. Solo despues de recibir la venta confirmada navega esa ventana al ticket con `automatico=true`; ante cualquier error la cierra y no intenta imprimir.

El script `deploy/windows/Abrir-TaiLilERP-POS.ps1` inicia Microsoft Edge con `--app` y `--kiosk-printing`. El navegador envia el trabajo a la impresora predeterminada sin dialogo. El HTML agrega alimentacion al final del ticket, pero la orden fisica de guillotina pertenece al driver: corte al finalizar trabajo para tickets o al finalizar pagina para etiquetas compatibles.
