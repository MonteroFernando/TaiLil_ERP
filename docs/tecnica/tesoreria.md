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

La migracion `20260822_0047` amplia `movimientos_caja` con `categoria`, `proveedor_id` opcional y `referencia`. Los historicos reciben `MOVIMIENTO_MANUAL` como valor inicial; no se alteran importes, fechas ni usuarios.

Desde `20260822_0048`, las respuestas de cuentas corrientes de proveedores y cada imputacion de `pago_vista` incluyen el comprobante de compra rastreable (letra, POI y numero). Los UUID permanecen como claves tecnicas para operar, pero la interfaz no los usa como rotulo comercial.

`cobro_vista` resuelve cada `venta_id` contra `ventas_documentos` y `puntos_venta` y devuelve `documento` con formato `LETRA PUNTO-NUMERO`. La UI conserva el UUID solamente para solicitar `GET /articulos/pos/ventas/{venta_id}` y presenta la respuesta `PosVentaVista` en un modal de solo lectura. Ese endpoint admite `tesoreria.ver`, ademas de los permisos de Ventas, porque el acceso nace desde la trazabilidad financiera. Como compatibilidad de despliegue, si una instancia anterior omite temporalmente `documento`, la web consulta esos tickets en paralelo y completa el mismo rotulo antes de renderizar el historial.

Los documentos usan claves UUID, numeracion secuencial, `Numeric(18,2)` para dinero, fechas con zona horaria y claves foraneas `RESTRICT` sobre historicos. Un cierre es unico por apertura. Una denominacion es unica dentro de un arqueo y un medio es unico dentro de un cierre.

Las imputaciones son muchos a muchos. La migracion `20260822_0046` retira los indices parciales unicos de las parejas cobro/venta y pago/factura. Esto permite completar en momentos distintos una aplicacion parcial sobre la misma pareja sin modificar el renglon anterior: cada tramo conserva UUID, importe, usuario y `fecha_imputacion`. Las validaciones transaccionales siguen impidiendo superar el disponible del cobro o pago y el saldo pendiente de la factura. Anular completa `estado`, usuario, fecha y motivo; no elimina filas.

## API

| Metodo | Ruta | Uso |
|---|---|---|
| `GET` | `/tesoreria/resumen` | Totales generales |
| `GET` | `/tesoreria/ventas` | Historico de ventas y saldos |
| `GET` | `/tesoreria/cuentas-corrientes/{tipo}` | Pendientes de `clientes` o `proveedores` |
| `GET` | `/tesoreria/cuentas-corrientes/clientes/resumen` | Posicion por cliente: deuda, anticipos, limite asignado, ocupado, remanente general y antiguedad |
| `GET` | `/tesoreria/cuentas-corrientes/proveedores/resumen` | Posicion consolidada por proveedor: deuda, pagos disponibles y antiguedad |
| `POST` | `/tesoreria/cobros` | Registrar cobro, medios e imputaciones |
| `POST` | `/tesoreria/pagos` | Registrar pago, medios e imputaciones |
| `GET` | `/tesoreria/cobros` | Cobros, disponible e historial |
| `GET` | `/tesoreria/pagos` | Pagos, disponible e historial |
| `POST` | `/tesoreria/conciliaciones/{tipo}` | Aplicar saldo existente |
| `POST` | `/tesoreria/conciliaciones/{tipo}/{imputacion_id}/anular` | Anular con motivo |
| `GET` | `/tesoreria/cajas/{apertura_id}/control` | Esperado por apertura y medio |
| `POST` | `/tesoreria/cajas/movimientos` | Ingreso o egreso manual |
| `POST` | `/tesoreria/cajas/retiros` | Registrar gasto directo o pago/anticipo a proveedor |
| `POST` | `/tesoreria/cajas/arqueos` | Guardar conteo por denominacion |
| `GET` | `/tesoreria/cajas/{apertura_id}/arqueos` | Historico de arqueos |
| `POST` | `/tesoreria/cajas/{apertura_id}/cerrar` | Crear cierre definitivo |
| `GET` | `/tesoreria/cajas/cierres/historial` | Consultar cierres guardados |

El historial admite `periodo` para una fecha exacta y `desde`/`hasta` para intervalos. Ordena primero por periodo operativo descendente y luego por hora real de cierre. La fecha no posee restriccion unica: cada apertura mantiene un solo cierre definitivo, pero un periodo diario puede contener muchos cierres.

`HistorialCierresCalendario.tsx` transforma la respuesta en grupos mensuales y genera una grilla de siete columnas con semana iniciada en lunes. Calcula el desplazamiento del primer dia y completa las celdas vacias hasta cerrar la ultima semana. Las fichas de cierre se renderizan dentro de la fecha correspondiente; el detalle por medio permanece plegado. El filtro mensual convierte `YYYY-MM` en el primer y ultimo dia reales y utiliza `desde`/`hasta`; el filtro diario utiliza `periodo`. La grilla usa un ancho minimo y desplazamiento horizontal en pantallas angostas para conservar la lectura de cada celda.

`DocumentoTesoreriaCrear` exige al menos un medio positivo. Admite varias imputaciones, rechaza documentos repetidos y requiere que el total imputado no supere el total del cobro o pago. Cada medio puede guardar una referencia.

`RetiroCajaCrear` acepta `GASTO_DIRECTO` o `PAGO_PROVEEDOR`. El segundo exige `proveedor_id` y crea `PagoDocumento` más `PagoMedioPago` dentro de una sola transaccion; su disponible queda conciliable por el circuito normal. El gasto directo crea `MovimientoCaja` de tipo `EGRESO` y categoria `GASTO_DIRECTO`. Nunca se crean ambos documentos para el mismo retiro.

En clientes y proveedores, la UI usa el resumen correspondiente como selector maestro y abre la gestion en un dialogo React. Al elegir una cuenta solicita `/cuentas-corrientes/{tipo}?socio_id=...` con el valor predeterminado `solo_pendientes=true`, por lo que los documentos con saldo cero quedan reservados para los historicos y nunca ofrecen campos de imputacion. Los listados reemplazan las busquedas individuales anteriores.

El resumen de clientes serializa `limite_asignado`, `credito_ocupado` y `credito_disponible` como `Decimal`, además de deuda y saldo a favor. Para una jerarquía, `deuda_actual`, `saldo_favor` y `documentos_pendientes` se consolidan y publican únicamente en la raíz; cada fila conserva `deuda_individual`, `saldo_favor_individual` y `documentos_individuales`. Así los totales no duplican deuda, pero los filtros todavía encuentran a una hija con movimientos propios.

`credito_ocupado` y `credito_disponible` siempre se calculan con la deuda individual del cliente de la fila. La autorización final del POS no usa el saldo consolidado: continúa validando al hijo seleccionado contra su propio límite general, límite del período y vencimiento. Los endpoints de detalle, cobros y pagos devuelven todo el grupo al consultar la raíz y sólo la actividad individual al consultar una hija; una conciliación puede cruzar documentos del mismo grupo, pero nunca de grupos distintos.

La consolidación se calcula dinámicamente desde `cuenta_padre_cliente_id` o `cuenta_padre_proveedor_id`; no cambia el propietario de ventas, facturas, cobros ni pagos. Por eso asignar `NULL` al vínculo excluye inmediatamente esos documentos del grupo anterior y convierte a la cuenta desvinculada en raíz de su propia deuda, sin migración de datos ni asientos compensatorios.

## Calculos

`disponible del pago = total confirmado - suma de imputaciones activas`.

`saldo de factura = total del documento - suma de imputaciones activas`.

El control de caja compone ventas y documentos financieros asociados a la apertura mas movimientos manuales confirmados. El cierre persiste tanto los acumulados como el esperado, declarado y diferencia por medio; no depende de recalcular datos futuros para mostrar el historico.

La migracion `20260822_0045` agrega solamente la columna `DATE` e indice de `periodo_operativo`. Para registros existentes toma la fecha argentina de `fecha_apertura`, luego establece `NOT NULL`. No borra ni vuelve a crear aperturas, ventas, arqueos o cierres.

La migracion `20260822_0046` elimina exclusivamente dos indices unicos parciales. No elimina, combina ni actualiza imputaciones existentes. El cambio permite insertar aplicaciones parciales adicionales conservando el historial completo.

La migracion `20260822_0047` usa solamente `ADD COLUMN`, una clave foranea e indices. Los movimientos anteriores conservan todos sus datos y quedan clasificados como `MOVIMIENTO_MANUAL` mediante `server_default`.

## Concurrencia y atomicidad

La creacion del documento, sus medios, sus imputaciones y la actualizacion de saldos se confirma dentro de una transaccion. Antes de imputar se validan socio, estado, saldo de factura y disponible del pago. Las aplicaciones automaticas de saldo a favor en POS bloquean los cobros elegibles con `SELECT ... FOR UPDATE`, en orden cronologico, para evitar doble consumo en ventas simultaneas.

Los totales de dinero se normalizan a dos decimales. Las reglas viven en la API y en restricciones de PostgreSQL; el navegador no es fuente de verdad.

## Migracion y reversa

Se aplica con Alembic y conserva los datos previos. Un `downgrade` debe evaluarse con respaldo y ventana de mantenimiento: si existen registros creados por el nuevo modelo, retirar tablas o restricciones puede ser incompatible. El procedimiento seguro esta en [Operacion Windows, Alembic e impresion](operacion-windows-alembic-impresion.md).
