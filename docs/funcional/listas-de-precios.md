# Listas de precios

El modulo **Ventas** contiene el control de listas de precios. Siempre existen dos listas iniciales:

- **COMPRAS**: lista base obligatoria. Guarda el precio bruto de compra por unidad base del articulo.
- **GENERAL**: lista comercial inicial, calculada sobre COMPRAS.

Por el momento todos los precios son **brutos**. No se descuenta ni separa IVA al guardar o calcular las listas.

Las listas comerciales poseen un porcentaje general de incremento sobre COMPRAS que se aplica por defecto a todos los articulos. Se pueden crear nuevas listas con el mismo funcionamiento.

## Excepciones por producto

Desde una lista comercial se busca un producto por codigo, descripcion, barra o codigo de proveedor. Para ese producto se puede:

- cambiar su precio bruto base de COMPRAS;
- asignar un porcentaje propio para la lista;
- asignar directamente un precio bruto manual;
- consultar el precio resultante y el margen porcentual sobre COMPRAS.

El margen se calcula como `(precio de venta / precio de compras - 1) * 100`. Si no existe una excepcion, el producto vuelve a utilizar el porcentaje general de la lista.

## Cambio automatico por cantidad

En los detalles del articulo se pueden crear reglas que indican a que lista debe cambiar cuando la cantidad supera un umbral expresado en unidad base. Solo puede existir una regla por articulo y lista.

Si una cantidad supera varios umbrales, se utiliza la regla con el umbral mas alto. Si no supera ninguna, se utiliza GENERAL.
