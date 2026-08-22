# Tesoreria: modelo, API e integridad

## Alcance y autorizacion

El router se publica bajo `/api/v1/tesoreria`. Las lecturas generales exigen `tesoreria.ver`; las escrituras generales, `tesoreria.gestionar`. Como excepcion acotada, el control y cierre de la caja propia aceptan `ventas.caja.cerrar`, sin habilitar cuentas corrientes, conciliaciones, pagos, movimientos manuales ni historicos generales. La API valida siempre el permiso y la propiedad de la apertura aunque el frontend oculte la navegacion.

## Modelo persistente

La migracion `20260821_0037` incorpora el nucleo de Tesoreria:

- `pagos_documentos` y `pagos_medios_pago` para egresos a proveedores;
- `imputaciones_pagos_facturas` para aplicar pagos a facturas de compra;
- ampliacion de cobros e `imputaciones_cobros_ventas` para conciliacion auditable;
- `movimientos_caja` para ingresos y egresos manuales;
- `arqueos_caja` y `arqueos_caja_detalles` para conteos por denominacion;
- `cierres_caja` y `cierres_caja_medios` para la foto definitiva de cada apertura;
- `aperturas_cajas.periodo_operativo` para vincular todos los turnos y cierres a un dia comercial;
- `saldo_pendiente` en las facturas de compra y relacion opcional de cobros/pagos con una apertura.

Los documentos usan claves UUID, numeracion secuencial, `Numeric(18,2)` para dinero, fechas con zona horaria y claves foraneas `RESTRICT` sobre historicos. Un cierre es unico por apertura. Una denominacion es unica dentro de un arqueo y un medio es unico dentro de un cierre.

Las imputaciones son muchos a muchos. El indice parcial unico impide duplicar una relacion activa entre el mismo pago/cobro y la misma factura, pero permite conservar la imputacion anulada y generar una nueva posteriormente. Anular completa `estado`, usuario, fecha y motivo; no elimina filas.

## API

| Metodo | Ruta | Uso |
|---|---|---|
| `GET` | `/tesoreria/resumen` | Totales generales |
| `GET` | `/tesoreria/ventas` | Historico de ventas y saldos |
| `GET` | `/tesoreria/cuentas-corrientes/{tipo}` | Pendientes de `clientes` o `proveedores` |
| `GET` | `/tesoreria/cuentas-corrientes/clientes/resumen` | Posicion consolidada por cliente: deuda, anticipos y antiguedad |
| `GET` | `/tesoreria/cuentas-corrientes/proveedores/resumen` | Posicion consolidada por proveedor: deuda, pagos disponibles y antiguedad |
| `POST` | `/tesoreria/cobros` | Registrar cobro, medios e imputaciones |
| `POST` | `/tesoreria/pagos` | Registrar pago, medios e imputaciones |
| `GET` | `/tesoreria/cobros` | Cobros, disponible e historial |
| `GET` | `/tesoreria/pagos` | Pagos, disponible e historial |
| `POST` | `/tesoreria/conciliaciones/{tipo}` | Aplicar saldo existente |
| `POST` | `/tesoreria/conciliaciones/{tipo}/{imputacion_id}/anular` | Anular con motivo |
| `GET` | `/tesoreria/cajas/{apertura_id}/control` | Esperado por apertura y medio |
| `POST` | `/tesoreria/cajas/movimientos` | Ingreso o egreso manual |
| `POST` | `/tesoreria/cajas/arqueos` | Guardar conteo por denominacion |
| `GET` | `/tesoreria/cajas/{apertura_id}/arqueos` | Historico de arqueos |
| `POST` | `/tesoreria/cajas/{apertura_id}/cerrar` | Crear cierre definitivo |
| `GET` | `/tesoreria/cajas/cierres/historial` | Consultar cierres guardados |

El historial admite `periodo` para una fecha exacta y `desde`/`hasta` para intervalos. Ordena primero por periodo operativo descendente y luego por hora real de cierre. La fecha no posee restriccion unica: cada apertura mantiene un solo cierre definitivo, pero un periodo diario puede contener muchos cierres.

`HistorialCierresCalendario.tsx` transforma la respuesta en grupos mensuales y genera una grilla de siete columnas con semana iniciada en lunes. Calcula el desplazamiento del primer dia y completa las celdas vacias hasta cerrar la ultima semana. Las fichas de cierre se renderizan dentro de la fecha correspondiente; el detalle por medio permanece plegado. El filtro mensual convierte `YYYY-MM` en el primer y ultimo dia reales y utiliza `desde`/`hasta`; el filtro diario utiliza `periodo`. La grilla usa un ancho minimo y desplazamiento horizontal en pantallas angostas para conservar la lectura de cada celda.

`DocumentoTesoreriaCrear` exige al menos un medio positivo. Admite varias imputaciones, rechaza documentos repetidos y requiere que el total imputado no supere el total del cobro o pago. Cada medio puede guardar una referencia.

En clientes y proveedores, la UI usa el resumen correspondiente como selector maestro y abre la gestion en un dialogo React. Al elegir una cuenta solicita `/cuentas-corrientes/{tipo}?socio_id=...` con el valor predeterminado `solo_pendientes=true`, por lo que los documentos con saldo cero quedan reservados para los historicos y nunca ofrecen campos de imputacion. Los listados reemplazan las busquedas individuales anteriores.

## Calculos

`disponible del pago = total confirmado - suma de imputaciones activas`.

`saldo de factura = total del documento - suma de imputaciones activas`.

El control de caja compone ventas y documentos financieros asociados a la apertura mas movimientos manuales confirmados. El cierre persiste tanto los acumulados como el esperado, declarado y diferencia por medio; no depende de recalcular datos futuros para mostrar el historico.

La migracion `20260822_0045` agrega solamente la columna `DATE` e indice de `periodo_operativo`. Para registros existentes toma la fecha argentina de `fecha_apertura`, luego establece `NOT NULL`. No borra ni vuelve a crear aperturas, ventas, arqueos o cierres.

## Concurrencia y atomicidad

La creacion del documento, sus medios, sus imputaciones y la actualizacion de saldos se confirma dentro de una transaccion. Antes de imputar se validan socio, estado, saldo de factura y disponible del pago. Las aplicaciones automaticas de saldo a favor en POS bloquean los cobros elegibles con `SELECT ... FOR UPDATE`, en orden cronologico, para evitar doble consumo en ventas simultaneas.

Los totales de dinero se normalizan a dos decimales. Las reglas viven en la API y en restricciones de PostgreSQL; el navegador no es fuente de verdad.

## Migracion y reversa

Se aplica con Alembic y conserva los datos previos. Un `downgrade` debe evaluarse con respaldo y ventana de mantenimiento: si existen registros creados por el nuevo modelo, retirar tablas o restricciones puede ser incompatible. El procedimiento seguro esta en [Operacion Windows, Alembic e impresion](operacion-windows-alembic-impresion.md).
