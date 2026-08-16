# Punto de venta

## Modelo transaccional

La migracion `20260816_0030` incorpora:

- `ventas_documentos` y `ventas_documentos_detalles` para cabecera y lineas comerciales.
- `cobros_documentos` y `cobros_medios_pago` para el documento financiero y sus medios combinados.
- `imputaciones_cobros_ventas` como relacion entre cobros y ventas.
- `secuencia_ventas` y `secuencia_cobros` para numeracion interna independiente.

La relacion de imputaciones es conceptualmente muchos a muchos. La restriccion unica evita repetir el mismo par cobro-venta; los futuros procesos de cobranza podran distribuir un cobro entre varias ventas.

## API

- `GET /api/v1/articulos/pos/precio` resuelve el precio operativo para una cantidad.
- `POST /api/v1/articulos/pos/ventas` confirma una venta POS.
- `GET /api/v1/articulos/pos/ventas` lista las ultimas ventas y admite filtro por cliente.
- `GET /api/v1/articulos/pos/ventas/{id}` devuelve el detalle.

La API recalcula precios, lista aplicable, neto e IVA; no acepta importes comerciales calculados por el frontend. Requiere `ventas.gestionar` para confirmar y `ventas.ver` para consultar.

## Atomicidad e inventario

La confirmacion usa una unica transaccion de base de datos. Dentro de ella se validan cliente, almacen, articulos, precios, stock, pagos y credito. Los articulos inventariables generan un movimiento `VENTA` con cantidad negativa; los servicios no impactan stock. Un stock insuficiente rechaza la operacion completa.

## Credito

Cuando el total pagado es menor al total bruto se valida `cuentas_corrientes_ventas`: estado activo, deuda maxima, limite del periodo y vencimiento de la deuda mas antigua. El saldo inicial de la venta es el importe que no fue cubierto por el cobro creado en el POS.

## Alcance fiscal

Los documentos son internos y no representan comprobantes fiscales. No existe todavia integracion con factura electronica, ARCA, CAE, puntos de venta fiscales ni numeracion fiscal.

