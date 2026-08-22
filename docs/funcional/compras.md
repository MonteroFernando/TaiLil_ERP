# Compras e ingresos de mercaderia

El modulo Compras separa el movimiento fisico de la valorizacion. Un **ingreso de mercaderia** exige proveedor, almacen y cantidades; aumenta el stock y queda disponible para facturar, pero no exige precios ni modifica costos.

Las notas recibidas del proveedor se cargan contra la factura original desde **Notas de credito**. Pueden reducir la cuenta por pagar con o sin devolucion fisica. Ver [Notas de credito](notas-de-credito.md).

La pantalla respeta el patron general de documentos: el listado permanece como vista principal y las altas se abren mediante botones separados **Nuevo ingreso** y **Nueva factura**. El formulario utiliza las mismas dimensiones, encabezados, tarjetas y acciones del resto del ERP.

Una **factura de compra** puede vincular un ingreso pendiente. En ese caso toma exactamente sus productos y cantidades, registra los costos y no vuelve a mover stock. Tambien puede cargarse directamente: confirma simultaneamente el ingreso fisico y la actualizacion de costos.

El proveedor filtra los articulos disponibles mediante las vinculaciones activas del maestro. Todos los costos son brutos y cada factura define una politica general, reemplazable por linea:

En cada renglon el articulo se selecciona con busqueda dinamica por palabras en cualquier orden. Se consideran codigo interno, descripcion, codigo de proveedor y todos los codigos de barra; se puede recorrer con flechas, confirmar con `Enter` y cerrar con `Escape`.

- **Cambiar costo:** adopta el costo bruto nuevo.
- **Promedio ponderado:** pondera stock y costo anteriores contra cantidad y costo nuevos.
- **No modificar:** conserva el costo vigente aunque registra el costo historico facturado.

Si el stock anterior es cero o negativo, el promedio no resulta representativo. El sistema toma directamente el costo bruto nuevo y muestra la advertencia en la linea y al confirmar. Cada documento conserva fecha y hora, usuario, proveedor, almacen, cantidades y referencias al movimiento de stock.

La futura recepcion mediante RF podra generar el mismo ingreso de mercaderia sin cambiar estas reglas.
