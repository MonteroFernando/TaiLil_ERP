# Maestro de articulos

## Objetivo

Mantener una unica definicion de cada producto que luego sera utilizada por punto de venta, compras, inventario, transferencias, facturacion y cuentas corrientes.

## Normalizacion de textos

Los textos y codigos ingresados por el usuario se guardan en mayusculas, aunque se escriban combinando mayusculas y minusculas. Esto unifica descripciones, presentaciones, proveedores y codigos para evitar diferencias solo por capitalizacion.

## Identificacion

Cada articulo tiene dos identificadores:

- `id`: UUID interno e inmutable para relaciones tecnicas.
- `codigo`: identificador visible según el tipo de articulo.

El usuario trabaja con el codigo visible. El UUID evita que un cambio futuro de formato afecte stock o documentos historicos.

### Productos fisicos

Reciben automáticamente cinco numeros consecutivos desde `00001`. Este formato permite reconocer rapidamente los productos habituales de venta, compra o inventario.

### Servicios y conceptos

Utilizan un codigo alfanumerico manual con al menos una letra, por ejemplo `FLETE`, `AJUSTE` o `SERV01`. No controlan inventario y no pueden marcarse como pesables. Las letras quedan reservadas para distinguirlos visualmente de los productos fisicos.

## Habilitaciones

Un articulo puede estar habilitado en general y, de manera independiente, para:

- Venta.
- Compra.
- Inventario.

Deshabilitarlo en general impide nuevas operaciones, pero nunca elimina su historial.

## Alicuota de IVA

Cada articulo conserva su alicuota de IVA. Las opciones iniciales son `0%`, `10,5%`, `21%` y `27%`; los articulos existentes quedan asignados a `21%` y el valor puede modificarse desde su ficha.

La alicuota permitira calcular el impuesto y obtener el precio neto cuando se incorporen precios y comprobantes. Si un importe incluye IVA:

```text
neto = importe final / (1 + porcentaje IVA / 100)
IVA = importe final - neto
```

## Unidades de medida

Todo articulo tiene una unidad base, por ejemplo unidad, kilogramo o litro. Puede agregar presentaciones propias con un factor respecto de la base:

```text
Caja x 12 = 12 unidades base
Bulto x 6 = 6 unidades base
Gramo = 0,001 kilogramos base
```

El factor pertenece al articulo, no a la unidad global, porque una caja puede contener cantidades diferentes según el producto.

### Unidad alternativa

Una presentacion adicional puede marcarse como `Unidad alternativa`. Solo puede existir una marcada por articulo y tambien es valido no seleccionar ninguna. La unidad base sigue siendo la unidad normal.

Los pedidos, compras, envios, ventas y transferencias utilizaran la unidad base normalmente. Cuando el usuario active `Usar unidad alternativa` en uno de esos movimientos, el sistema tomara la presentacion marcada y aplicara su conversion:

```text
cantidad del movimiento x factor de la presentacion = cantidad en unidad base
2 bultos x 6 = 12 unidades base
```

Marcar una nueva presentacion desmarca automaticamente la anterior. El indicador se muestra como un checkbox para mantener limpia la ficha del articulo.

## Codigos de barras

Un articulo admite varios codigos de barras. Cada codigo utiliza uno de dos modos:

1. **Cantidad directa:** descuenta una cantidad explicita; el valor predeterminado es `1`.
2. **Unidad vinculada:** descuenta el factor configurado en la presentacion del articulo.

Ejemplo: un codigo puede descontar directamente 12 unidades o vincularse a “Caja x 12”. El segundo modo reutiliza la conversion y evita duplicar el factor.

## Productos pesables

La marca `es_pesable` identifica productos vendidos por peso. En esta etapa se almacena la condicion y su unidad base. La lectura de etiquetas de balanza con peso o importe embebido se definira cuando integremos el punto de venta.

## Proveedores

Un articulo puede relacionarse con varios proveedores. Para cada relacion se conserva:

- Codigo utilizado por el proveedor.
- Estado activo o inactivo.
- Indicacion de proveedor principal.

El codigo del proveedor no reemplaza el codigo interno de TaiLil.

## Modificacion y eliminacion

- Los codigos de barras pueden modificarse o eliminarse.
- Las presentaciones adicionales pueden modificar su nombre, unidad y factor.
- La unidad base queda protegida y no puede modificarse ni eliminarse.
- Una presentacion vinculada a un codigo de barras no puede eliminarse hasta quitar o modificar ese codigo.
- El codigo interno de un proveedor puede modificarse y el proveedor puede desvincularse del articulo.

## Fuera de esta etapa

Precios, listas, ofertas, impuestos, costos, lotes y reglas de reposicion se incorporaran en iteraciones posteriores sin modificar la identidad del articulo.
