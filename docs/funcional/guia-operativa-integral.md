# Guía operativa integral

Esta guía reúne el orden recomendado para configurar y utilizar Morita. Los manuales enlazados contienen todos los campos y reglas particulares.

## 1. Preparación administrativa

1. Ingresar con un administrador.
2. Crear perfiles según la función real de cada persona.
3. Asignar permisos de consulta y gestión solamente cuando correspondan.
4. Crear los usuarios y entregar su contraseña temporal.
5. Confirmar que cada usuario vea únicamente sus módulos.

Para un operador de mostrador utilizar el perfil **CAJERO**. Este perfil abre, opera y cierra su caja, pero no accede a Tesorería, Compras, Stock, Informes, notas de crédito ni configuraciones.

Detalle: [Permisos y perfiles](permisos-y-perfiles.md).

## 2. Datos maestros

Antes de operar deben existir:

- almacén principal;
- puntos de venta y cajas;
- clientes y proveedores necesarios;
- unidades de medida y alícuotas;
- artículos con sus habilitaciones;
- listas de precios activas.

Al crear un producto se puede indicar stock inicial por almacén. Esa existencia genera un movimiento y queda auditada. Los artículos comprables pueden relacionarse con códigos particulares de proveedor y múltiples códigos de barras.

Detalle: [Maestro de artículos](maestro-de-articulos.md) y [Clientes y proveedores](maestro-clientes-proveedores.md).

## 3. Compras y costos

### Ingreso previo

1. Abrir **Compras → Nuevo ingreso**.
2. Seleccionar proveedor y almacén.
3. Buscar artículos por código, descripción, barra o referencia del proveedor.
4. Indicar cantidades y confirmar.
5. Cuando llegue la factura, abrir **Nueva factura** y vincular el ingreso pendiente.

### Factura con stock directo

Si no hubo ingreso previo, la factura puede cargar cantidades y costos y aumentar stock en la misma confirmación.

La política general o particular define si el costo nuevo reemplaza, promedia o no modifica el costo vigente. Todos los costos operativos de esta pantalla son brutos.

### Reposición

Abrir **Rotación y reposición**, indicar días de análisis, proyección y almacén. Revisar primero los productos con mayor rotación y luego la compra sugerida. La sugerencia descuenta el disponible y lo que ya está pedido; es informativa y no genera una factura automáticamente.

Detalle: [Compras](compras.md).

## 4. Inventario

En **Control de stock** se consultan existencias, movimientos y transferencias. Las cantidades presentan hasta tres decimales.

Para un inventario físico:

1. crear el inventario del almacén;
2. imprimir o utilizar la planilla en pantalla;
3. cargar todos los conteos;
4. guardar avances si es necesario;
5. finalizar para registrar diferencias y ajustes.

Un conteo con diferencia cero también permanece en el histórico, demostrando que el producto fue revisado y estaba correcto.

Detalle: [Stock e inventarios](clasificadores-almacenes-stock.md).

## 5. Apertura y operación del POS

1. Seleccionar la caja.
2. Elegir la fecha operativa a la que pertenecerá el turno.
3. Declarar el efectivo inicial.
4. Abrir la caja.

Durante la venta:

- escanear el código y presionar `Enter`;
- utilizar `cantidad*código` para multiplicadores;
- buscar con `F2` y consultar precios con `F3`;
- seleccionar el cliente cuando corresponda;
- revisar el disponible total si posee cuenta corriente;
- cobrar con `F10` e indicar expresamente todos los medios.

Para cuenta corriente se debe agregar el medio específico. No se permite confirmar dejando una diferencia sin explicar. Los borradores pueden recuperarse y no consumen numeración hasta confirmarse.

Detalle: [Punto de venta](punto-de-venta.md).

## 6. Impresión

El usuario puede elegir **Vista previa** o **Impresión directa**. La preferencia se comparte entre POS y Etiquetas en el mismo navegador.

La impresión directa requiere abrir Edge con el procedimiento especial y configurar en el driver el corte al finalizar el trabajo. El sistema no puede activar físicamente un cortador que la impresora no posea.

Detalle: [Impresión directa](impresion-directa.md).

## 7. Notas de crédito

La emisión requiere autorización expresa. Desde el POS o Tesorería se emiten notas de clientes; desde Compras se accede a las de proveedores.

- Una devolución selecciona renglones de una factura y puede reintegrar stock.
- Una nota narrativa registra una diferencia de precio u otro motivo sin renglones físicos.
- Toda nota queda vinculada al comprobante original.
- Si existe devolución de dinero, debe vincularse una apertura de caja y un medio.

Detalle: [Notas de crédito](notas-de-credito.md).

## 8. Cuentas corrientes

1. Entrar en **Tesorería → Cuentas corrientes**.
2. Elegir clientes/cobros o proveedores/pagos.
3. Buscar en el listado general.
4. Pulsar **Abrir cuenta**.
5. Revisar deuda, saldo a favor y documentos pendientes.
6. Registrar el cobro o pago.
7. Imputar importes a uno o varios documentos.

Si una factura tiene saldo cero no admite imputaciones nuevas. Si el cobro supera la deuda, el remanente queda como pago sin aplicar o saldo a favor. Las conciliaciones se conservan y una anulación exige motivo.

Detalle: [Tesorería](tesoreria.md).

## 9. Arqueo y cierre

En **Caja y arqueo** seleccionar la apertura correcta verificando primero su fecha operativa.

- Los movimientos manuales registran ingresos o egresos con concepto.
- El arqueo cuenta efectivo por denominación y puede repetirse durante el turno.
- El cierre compara esperado y declarado por medio y es definitivo para la apertura.

El histórico usa una cuadrícula de calendario. **Filtrar por mes** trae todo el mes; **Buscar día operativo** busca una fecha exacta. Cada día puede contener varios cierres y cada ficha despliega el control completo.

## 10. Informes y Excel

Con `informes.ver` se consultan:

- entradas, salidas y flujo neto;
- comprobantes de venta y notas de crédito;
- costo histórico, margen monetario y margen porcentual;
- rentabilidad combinada de documentos seleccionados.

Los filtros admiten fechas, clientes y productos. Las tablas analíticas habilitadas muestran el icono de Excel en el encabezado. Verificar que los importes se abran como números y con formato monetario.

Detalle: [Informes y Excel](informes-y-exportacion-excel.md).

## 11. Control diario recomendado

Al comenzar:

1. comprobar fecha operativa;
2. abrir la caja correcta;
3. verificar impresora y modo de impresión;
4. revisar alertas de stock y reposición.

Al finalizar:

1. confirmar o eliminar borradores;
2. realizar arqueo;
3. revisar diferencias;
4. cerrar la caja;
5. comprobar el cierre en el calendario;
6. revisar flujo de dinero y ventas del período si se posee permiso.

Nunca corregir saldos o históricos directamente en PostgreSQL. Ante una diferencia utilizar el documento, ajuste, nota o anulación previsto por el sistema.
