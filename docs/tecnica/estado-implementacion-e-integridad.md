# Estado técnico e integridad

Referencia técnica consolidada vigente al **22 de agosto de 2026**.

## Plataforma

```text
Navegador / Edge
       |
Next.js 16 + React 19 :3000
       |  /api/v1 proxy
FastAPI + SQLAlchemy async :8000
       |
PostgreSQL
```

El backend es un monolito modular. Los routers se componen bajo `/api/v1`; los modelos SQLAlchemy comparten metadatos y Alembic es el único mecanismo de modificación del esquema.

## Revisión de esquema

```text
20260822_0045 (head)
```

Evolución funcional reciente:

| Revisión | Cambio |
|---|---|
| `0037` | Tesorería integral, pagos, conciliaciones, arqueos y cierres |
| `0038` | Stock inicial e inventarios con diferencia cero |
| `0039` | Costo histórico en líneas de venta |
| `0040` | Permiso independiente de informes |
| `0041` | Notas de crédito de clientes y proveedores |
| `0042` | Perfil y permisos acotados de cajero |
| `0043` | Notas narrativas y devolución vinculada a caja |
| `0044` | Autorización expresa para emitir notas de crédito |
| `0045` | Fecha operativa para aperturas y calendario de cierres |

Las migraciones usan `ALTER`, altas de tablas, índices y actualizaciones controladas. No recrean la base ni eliminan datos para avanzar de versión. Antes de una actualización productiva igualmente se debe mantener un respaldo independiente de PostgreSQL.

## Autorización

La API utiliza `requerir_permiso`, `requerir_alguno_de` o validación administrativa según el endpoint. El frontend obtiene usuario y permisos efectivos antes de montar contenido protegido.

Matriz principal:

| Ruta web | Requisito |
|---|---|
| `/socios-negocio`, `/articulos`, `/clasificadores` | `datos_maestros.ver` |
| `/stock`, `/almacenes` | `inventario.ver` |
| `/compras` | `compras.ver` |
| `/ventas/pos` | `ventas.ver` o `ventas.caja.operar` |
| `/ventas/listas-precios`, `/ventas/etiquetas` | `ventas.ver` |
| `/tesoreria` | `tesoreria.ver` |
| `/informes` | `informes.ver` |
| `/notas-credito` | `ventas.ver` o `compras.ver`; la emisión de cliente exige permiso expreso |
| Configuración y accesos | administrador |

La ocultación visual no constituye autorización: todos los endpoints sensibles vuelven a verificar usuario, propiedad de la caja y permiso.

## Integridad transaccional

### Inventario

`stocks_articulos_almacenes` conserva físico, pedido y reservado. Cada impacto confirmado genera `movimientos_stock` y detalles con saldo anterior y posterior. Las transferencias registran ambos almacenes; inventarios y stock inicial utilizan el mismo historial.

### Ventas

La confirmación asigna numeración y registra documento, líneas, costo histórico, cobro, imputaciones y movimiento de stock en una transacción. Los borradores no numeran ni impactan stock. La apertura se bloquea y valida antes de operar.

### Cuenta corriente

`saldo_pendiente` es la fuente inmediata para documentos. Las imputaciones permiten muchos cobros contra muchas ventas y muchos pagos contra muchas facturas. No se admite superar el saldo del documento ni el disponible del pago. Las anulaciones cambian estado, guardan usuario, fecha y motivo y restituyen el pendiente.

### Cierre

Cada apertura admite un cierre definitivo. Un período operativo admite múltiples aperturas y, por lo tanto, múltiples cierres. `cierres_caja` y `cierres_caja_medios` guardan la fotografía final; el histórico no recalcula valores usando operaciones posteriores.

### Notas de crédito

La nota referencia el documento original. La modalidad física valida cantidades y puede revertir stock; la narrativa conserva motivo e importe sin simular artículos. El impacto financiero y, cuando corresponde, la devolución de caja se confirman juntos.

## Cálculos analíticos

### Margen

```text
margen = importe neto del comprobante - costo histórico
margen % = margen / importe * 100
```

Las notas de crédito reducen importe y costo según su vínculo. La selección múltiple calcula rentabilidad combinada sobre los documentos elegidos.

### MRP simple

```text
promedio diario = vendido / días trabajados con stock
necesidad = promedio diario * días de proyección
sugerencia = max(necesidad - disponible - pedido, 0)
```

El saldo al inicio del análisis se reconstruye hacia atrás usando saldo anterior de los movimientos. Los productos no pesables se redondean hacia arriba a unidad; los pesables conservan 0,001.

## Frontend transversal

- `NavegacionPrincipal.tsx`: marca, tema, permisos, rutas y navegación.
- `SelectorTema.tsx`: claro/oscuro persistente.
- `BuscadorArticulo.tsx`: búsqueda incremental y teclado.
- `TablaOrdenable.tsx`: orden local por encabezado.
- `ExportarExcel.tsx`: exportación opt-in de tablas visibles.
- `RotacionCompras.tsx`: análisis MRP.
- `HistorialCierresCalendario.tsx`: filtro diario/mensual y cuadrícula de calendario.
- `ModalNotaCreditoPos.tsx`: emisión autorizada desde el POS.
- `formato.ts`: moneda, miles y máximo de tres decimales.

## Excel

El exportador inspecciona únicamente tablas visibles marcadas con `data-exportar-excel="true"`. Convierte moneda, porcentajes y cantidades locales a números antes de escribir la celda. Los campos monetarios usan formato Excel y permanecen calculables.

## Operación Windows

Los scripts de `deploy/windows` inician y detienen API y web, y abren Edge con impresión directa. El procedimiento de actualización detiene servicios, consulta Alembic, ejecuta `upgrade head`, compila Next.js, reinicia y comprueba puertos y endpoints.

No ejecutar `downgrade`, borrar volúmenes ni recrear PostgreSQL como procedimiento normal de actualización.

## Verificación recomendada

Backend:

```powershell
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" current
& ".\.venv\Scripts\python.exe" -m pytest ".\apps\api\tests" -q
& ".\.venv\Scripts\ruff.exe" check ".\apps\api"
```

Frontend:

```powershell
Push-Location ".\apps\web"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Pop-Location
```

En un servidor con Next.js activo se deben detener los servicios antes de `npm run build`, porque el proceso puede mantener bloqueado `.next`.

## Fuentes de detalle

- [Índice técnico](README.md)
- [Base de datos](base-de-datos.md)
- [Punto de venta](punto-de-venta.md)
- [Tesorería](tesoreria.md)
- [Informes y Excel](informes-y-exportacion-excel.md)
- [MRP](compras-rotacion-mrp.md)
- [Operación Windows](operacion-windows-alembic-impresion.md)
