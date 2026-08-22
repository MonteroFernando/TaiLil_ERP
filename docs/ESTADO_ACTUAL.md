# Estado actual de Morita sobre TaiLil ERP

Documento de referencia vigente al **22 de agosto de 2026**. Describe la funcionalidad efectivamente implementada y enlaza los manuales que contienen el detalle operativo y técnico.

## Identidad y experiencia visual

La aplicación se presenta comercialmente como **Morita**. El acceso y la navegación muestran el logotipo de Morita y la autoría:

```text
Power by TaiLil ERP
TaiLil Soluciones Tecnológicas by Fernando Montero
```

La paleta principal deriva del verde y los tonos cálidos del logotipo. El usuario puede alternar en cualquier momento entre tema claro y oscuro mediante los controles de sol y luna. La elección permanece guardada en el navegador.

Los importes se muestran con separadores argentinos y formato monetario. Las cantidades operativas utilizan separador de miles y hasta tres decimales. Las tablas extensas permiten ordenar al tocar el encabezado.

## Seguridad y permisos

La autenticación utiliza sesiones revocables y contraseñas Argon2id. Los permisos efectivos son la unión de asignaciones directas y perfiles activos.

- Un módulo sin permiso no aparece en la navegación.
- Los grupos vacíos tampoco se muestran.
- Una URL escrita manualmente no monta el módulo sin autorización y vuelve al panel.
- La API valida nuevamente el permiso en cada operación.
- **Configuración de accesos** y **Configuración POS** son exclusivas de administradores.
- El perfil **CAJERO** puede operar y cerrar solamente su propia caja.
- La emisión de notas de crédito exige `ventas.notas_credito.emitir`, incluso para usuarios con otras tareas de ventas.
- Informes exige el permiso independiente `informes.ver`.

Véase [Permisos y perfiles](funcional/permisos-y-perfiles.md).

## Módulos disponibles

| Área | Funcionalidad principal | Manual |
|---|---|---|
| Acceso | Login Morita, cambio obligatorio de clave, sesiones y temas | [Acceso y seguridad](funcional/acceso-y-seguridad.md) |
| Administración | Usuarios, perfiles y permisos directos | [Administración de accesos](funcional/administracion-accesos.md) |
| Maestros | Artículos, clientes, proveedores, domicilios y cuentas agrupadoras | [Manual de maestros](funcional/maestro-de-articulos.md) |
| Inventario | Almacenes, existencias, movimientos, transferencias e inventarios físicos | [Stock e inventarios](funcional/clasificadores-almacenes-stock.md) |
| Compras | Ingresos, facturas, costos y MRP simple | [Compras](funcional/compras.md) |
| Precios | Listas, reglas por cantidad y excepciones | [Listas de precios](funcional/listas-de-precios.md) |
| POS | Escaneo, cobro, cuenta corriente, impresión, borradores y cierre | [Punto de venta](funcional/punto-de-venta.md) |
| Notas de crédito | Clientes y proveedores, devolución o narrativa | [Notas de crédito](funcional/notas-de-credito.md) |
| Tesorería | Cuentas corrientes, conciliaciones, caja, arqueos y cierres | [Tesorería](funcional/tesoreria.md) |
| Informes | Flujo de dinero, ventas, costos, margen y Excel | [Informes](funcional/informes-y-exportacion-excel.md) |
| Etiquetas | Diseño e impresión de etiquetas de precio | [Etiquetas](funcional/etiquetas-precios.md) |

## Reglas transversales

### Búsquedas

La búsqueda incremental de artículos considera código interno, palabras de la descripción en cualquier orden, códigos de barras y código del proveedor. En los maestros se usa el mismo criterio de términos múltiples para nombres, códigos y documentos. `Enter` confirma una opción válida y el desplegable se cierra al seleccionar, perder el foco o no tener una consulta activa.

### Históricos

El stock inicial genera un movimiento histórico. Los inventarios guardan también los conteos cuya diferencia es cero. Los movimientos de stock se muestran cronológicamente por fecha y hora ascendentes cuando se revisa la evolución de un artículo.

Las ventas conservan costo histórico por línea. Esto permite revisar importes y márgenes sin sustituirlos por el costo vigente. Los cierres de caja guardan una fotografía definitiva de lo esperado, declarado y sus diferencias.

### Excel

Solo los listados útiles para análisis se habilitan para exportación. El icono de Excel aparece en el encabezado, no flotando sobre la pantalla. Importes y cantidades se escriben como celdas numéricas con formato; nunca como textos que impidan sumar, ordenar o crear fórmulas.

No se exportan pantallas operativas como etiquetas, POS, formularios o configuraciones.

## Flujos principales

### Compra y reposición

Una compra puede comenzar con ingreso físico y facturarse después, o confirmarse como factura con ingreso directo. La política de costo puede reemplazar, promediar o conservar el valor anterior.

**Rotación y reposición** calcula días trabajados, días con stock, venta, promedio diario, disponible, mercadería pedida, necesidad proyectada y sugerencia de compra. La fórmula y reconstrucción histórica están explicadas en [MRP simple](tecnica/compras-rotacion-mrp.md).

### Venta y cobro

El POS exige una caja abierta y una fecha operativa. El artículo puede escanearse y agregarse con `Enter`; `F2` devuelve el foco al buscador, `F3` abre la consulta de precios y `F10` inicia el cobro.

La venta debe quedar cubierta mediante medios de pago explícitos. La cuenta corriente nunca se supone por una diferencia: debe elegirse y validarse contra saldo a favor, crédito autorizado y deuda vencida. El saldo a favor se muestra dentro del disponible total.

### Cuenta corriente y conciliación

Tesorería comienza con un listado general de clientes o proveedores. **Abrir cuenta** muestra en un modal posición, documentos, cobros o pagos, saldos disponibles, historial y conciliaciones.

La relación es muchos a muchos: un pago puede aplicarse a varias facturas y una factura puede recibir varios pagos. Solo se puede imputar saldo real pendiente; los anticipos quedan como saldo a favor hasta su aplicación.

### Caja y período operativo

La fecha operativa se elige al abrir la caja y puede contener varias aperturas y cierres de cajas o turnos. Las horas reales se conservan por separado. El historial se presenta como calendario mensual de lunes a domingo, con filtros por mes o día y varias fichas de cierre dentro de la fecha correspondiente.

## Integridad y base de datos

La revisión Alembic vigente es:

```text
20260822_0045 (head)
```

Las actualizaciones se realizan exclusivamente mediante migraciones incrementales. La revisión `0045` agregó la fecha operativa y completó los registros anteriores usando la fecha argentina de apertura; no eliminó ventas, cajas ni cierres.

Los históricos financieros y de inventario usan claves foráneas restrictivas. Las operaciones confirmadas no se corrigen borrando filas: se utilizan notas de crédito, anulaciones trazables, ajustes o movimientos compensatorios según corresponda.

## Operación del sistema

- Procedimiento completo: [Operación Windows, Alembic e impresión](tecnica/operacion-windows-alembic-impresion.md).
- Bloque PowerShell copiable: [PASOS_ACTUALIZAR_Y_ARRANCAR.txt](../PASOS_ACTUALIZAR_Y_ARRANCAR.txt).
- Impresión directa: [IMPRESION_DIRECTA_WINDOWS.txt](../IMPRESION_DIRECTA_WINDOWS.txt).
- Recorrido diario: [Guía operativa integral](funcional/guia-operativa-integral.md).
- Mantenimiento: [Estado técnico e integridad](tecnica/estado-implementacion-e-integridad.md).

## Alcance fiscal actual

Los comprobantes comerciales son documentos internos del ERP. La numeración, impresión y trazabilidad están implementadas, pero la integración con servicios fiscales externos o autorización electrónica requiere un módulo específico antes de considerar al documento una factura fiscal autorizada.
