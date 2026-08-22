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

## Rotacion y reposicion (MRP simple)

El encabezado de Compras incorpora **Rotacion y reposicion**. Esta vista permite ordenar los productos con mayor movimiento y estimar una compra sin generar documentos ni cambiar existencias. Requiere el permiso `compras.ver`.

El usuario define:

- **Dias de analisis:** ventana calendario hacia atras, entre 1 y 365 dias.
- **Proyeccion:** cantidad de dias futuros que se desean cubrir, entre 1 y 365 dias.
- **Almacen:** uno en particular o todos consolidados.
- **Busqueda:** codigo y descripcion, con varias palabras en cualquier orden.
- **Solo con compra sugerida:** oculta los productos cuya cobertura actual ya es suficiente.

El calculo no divide por todos los dias calendario. Primero detecta los **dias trabajados**, es decir, jornadas que tuvieron al menos una venta confirmada. Para cada producto toma de esas jornadas solamente aquellas en las que hubo stock. De este modo, una falta de mercaderia no reduce artificialmente su promedio de venta.

Las formulas son:

1. `rotacion diaria = cantidad vendida / dias trabajados con stock del producto`;
2. `necesidad proyectada = rotacion diaria x dias de proyeccion`;
3. `compra sugerida = max(necesidad proyectada - disponible - cantidad pedida, 0)`.

**Disponible** es stock fisico menos reserva, sin considerar valores negativos como disponibilidad. **En pedido** se descuenta porque ya representa mercaderia esperada. Los productos comunes se redondean hacia arriba a unidades enteras; los pesables conservan hasta tres decimales.

La grilla muestra posicion, producto, dias con stock, venta del periodo, rotacion diaria, disponible, en pedido, necesidad y sugerencia. Inicia de mayor a menor rotacion, permite ordenar por cualquier encabezado y se puede exportar a Excel mediante el icono del encabezado. Las cantidades se exportan como numeros, no como texto.

El boton circular **?** abre una explicacion de todos estos conceptos dentro de la pantalla. El resultado es orientativo: no confirma una compra ni reserva stock automaticamente.
