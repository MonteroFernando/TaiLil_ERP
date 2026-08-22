# Notas de credito: diseño tecnico

La migracion `20260821_0041` crea `secuencia_notas_credito`, `notas_credito` y `notas_credito_detalles`. La cabecera discrimina `CLIENTE` o `PROVEEDOR` y exige exactamente un origen y documento financiero: `venta_id/cobro_id` o `factura_compra_id/pago_id`. Los detalles referencian el renglon original y congelan articulo, cantidad, importe, IVA y total.

## API

| Metodo | Ruta | Funcion |
|---|---|---|
| `GET` | `/api/v1/notas-credito/origenes?tipo=CLIENTE|PROVEEDOR` | Origenes y cantidades acreditables |
| `POST` | `/api/v1/notas-credito` | Confirmar nota, saldo y stock |
| `GET` | `/api/v1/notas-credito?tipo=...` | Historico autorizado |
| `GET` | `/api/v1/notas-credito/{id}/imprimir` | Representacion imprimible |

Usa permisos `ventas.*` para clientes y `compras.*` para proveedores. La confirmacion bloquea comprobante, renglones y existencias con `SELECT ... FOR UPDATE`; rechaza cantidades acumuladas superiores al origen y recalcula importes historicos en servidor.

Para clientes crea un cobro con medio `NOTA_CREDITO`; para proveedores, un pago equivalente. Imputa hasta el saldo original y deja el excedente disponible. Este medio se excluye del flujo de dinero porque no mueve efectivo.

Si afecta stock crea `NOTA_CREDITO_CLIENTE` positiva o `NOTA_CREDITO_PROVEEDOR` negativa. Nota, detalles, imputacion, saldo y stock se confirman juntos. El informe de margenes descuenta tanto la nota como el costo historico devuelto y exporta valores numericos.
