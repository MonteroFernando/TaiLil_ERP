# Notas de credito: diseño tecnico

La migracion `20260821_0041` crea `secuencia_notas_credito`, `notas_credito` y `notas_credito_detalles`. La migracion aditiva `20260822_0043` incorpora `modalidad`, `devolucion_cobro_id` y `movimiento_caja_id`; utiliza valores predeterminados y no elimina ni reescribe notas existentes. La cabecera discrimina `CLIENTE` o `PROVEEDOR` y exige exactamente un origen y documento financiero: `venta_id/cobro_id` o `factura_compra_id/pago_id`. Los detalles referencian el renglon original y congelan articulo, cantidad, importe, IVA y total.

## API

| Metodo | Ruta | Funcion |
|---|---|---|
| `GET` | `/api/v1/notas-credito/origenes?tipo=CLIENTE|PROVEEDOR` | Origenes y cantidades acreditables |
| `POST` | `/api/v1/notas-credito` | Confirmar nota, saldo y stock |
| `GET` | `/api/v1/notas-credito?tipo=...` | Historico autorizado |
| `GET` | `/api/v1/notas-credito/{id}/imprimir` | Representacion imprimible |

La consulta de clientes usa `ventas.ver`, pero el `POST` exige específicamente `ventas.notas_credito.emitir`; `ventas.gestionar` no lo sustituye. Para proveedores se mantienen `compras.ver` y `compras.gestionar`. La confirmacion bloquea comprobante, renglones y existencias con `SELECT ... FOR UPDATE`; rechaza cantidades acumuladas superiores al origen y recalcula importes historicos en servidor.

Para clientes crea un cobro con medio `NOTA_CREDITO`; para proveedores, un pago equivalente. Imputa hasta el saldo original y deja el excedente disponible. Este medio se excluye del flujo de dinero porque no mueve efectivo.

`PRODUCTOS` exige renglones y puede afectar stock. `NARRATIVA` se limita a clientes, exige `importe_narrativo`, no admite renglones y fuerza `afecta_stock=false`. La suma confirmada de notas no puede superar el total del comprobante original.

Si se solicita devolucion en caja, la API exige una apertura abierta propia y un medio. Aplica primero la nota a la deuda; solo devuelve el excedente. Crea un cobro compensatorio negativo sin apertura para consumir el saldo a favor y un `MovimientoCaja` de tipo `EGRESO` en la apertura elegida. El medio tecnico `DEVOLUCION_NC` se excluye del flujo para evitar duplicar el egreso ya representado por el movimiento de caja.

Si afecta stock crea `NOTA_CREDITO_CLIENTE` positiva o `NOTA_CREDITO_PROVEEDOR` negativa. Nota, detalles, imputacion, saldo, devolucion y stock se confirman juntos. El informe de margenes lista factura y notas por separado: las notas de productos revierten costo historico y las narrativas tienen costo cero.
