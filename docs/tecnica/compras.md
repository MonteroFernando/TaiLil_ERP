# Implementacion tecnica de Compras

La migracion `20260817_0036` crea `ingresos_mercaderia`, `ingresos_mercaderia_detalles`, `facturas_compra` y `facturas_compra_detalles`, junto con secuencias independientes. Los detalles guardan snapshots de stock y costo anteriores, costo bruto facturado, costo resultante, politica y advertencia.

La migracion `20260822_0048` agrega a `facturas_compra` los campos obligatorios `letra`, `punto_emision` y `numero_factura`. Los comprobantes nuevos se normalizan como `LETRA POI-NUMERO`. `numero_proveedor` se conserva por compatibilidad e historico, pero los endpoints y pantallas exponen `comprobante_proveedor` como referencia comercial. Los registros anteriores se intentan separar cuando ya poseen el formato fiscal; los demas quedan marcados como legado y conservan literalmente la referencia previa.

Endpoints bajo `/api/v1/articulos/compras`:

- `GET|POST /ingresos`;
- `GET|POST /facturas`.

Las escrituras requieren `compras.gestionar` y las consultas `compras.ver`. `GET /api/v1/articulos?proveedor_id=...` filtra mediante `articulos_proveedores` activos.

`FacturaCompraCrear` exige `letra`, `punto_emision` y `numero_factura`; ya no acepta un texto libre como unica identificacion. Antes del alta se comprueba que el mismo proveedor no tenga registrada la combinacion fiscal y la base refuerza la regla con `uq_factura_compra_comprobante_proveedor`, evitando duplicados incluso ante solicitudes concurrentes. `DocumentoCompraVista` devuelve los tres componentes y `comprobante_proveedor`.

La carga reutiliza `BuscadorArticulo`; el backend combina cada termino con `AND` y los campos/codigos relacionados con `OR`, incluyendo `articulos_proveedores.codigo_proveedor` y codigos de barra mediante `EXISTS`. No se implementa un selector de compras divergente.

El ingreso crea un movimiento `INGRESO_MERCADERIA`. La factura directa crea `FACTURA_COMPRA`; una factura vinculada no genera movimiento y cambia el ingreso a `FACTURADO`. La restriccion unica sobre `facturas_compra.ingreso_id` impide valorizar dos veces el mismo ingreso.

Para promedio, si `stock_anterior > 0`, se aplica `(stock_anterior * costo_anterior + cantidad * costo_nuevo) / (stock_anterior + cantidad)`. Si el stock es cero o negativo, se usa el costo nuevo y se persiste la advertencia. La columna `precios_articulos_base.precio_bruto` sigue siendo la fuente del costo vigente bruto.
