# Patron general de maestros y busquedas

Esta regla se aplica a clientes, proveedores, articulos y a los futuros maestros del ERP.

## Pantalla principal

La pantalla principal contiene solamente:

- titulo y boton **Nuevo**;
- buscador en la parte superior;
- listado general debajo del buscador.

Los formularios de alta y los indices internos no se mezclan con el listado. Cada fila se destaca al pasar el puntero y ofrece la accion **Ver detalle**.

## Ficha de alta y detalle

Al seleccionar un registro o pulsar **Nuevo**, se navega en la misma pestaña hacia una ficha independiente del listado. Su cabecera muestra permanentemente el tipo, codigo, nombre, documento y estado del registro. Debajo aparecen pestañas consistentes para crear o modificar: datos generales, fiscales y domicilios/contactos.

**Cuentas agrupadoras** es un maestro general y no una pestaña de un cliente o proveedor particular. Se accede desde un boton ubicado junto al boton **Nuevo** en las pantallas principales de clientes y proveedores.

Las pestañas que necesitan un registro previamente guardado permanecen deshabilitadas durante el alta. El boton de guardar se ubica al final del formulario y expresa si va a crear o modificar.

## Busqueda incremental global

La busqueda se ejecuta automaticamente mientras se escribe, sin boton de confirmacion. Las palabras pueden escribirse en cualquier orden: cada palabra debe aparecer en alguno de los campos habilitados, aunque no sea en el mismo campo.

Cuando una operacion requiere seleccionar un articulo, el buscador muestra un desplegable incremental. Busca simultaneamente por codigo interno, descripcion, todos sus codigos de barra y los codigos asignados por cualquiera de sus proveedores. Se puede recorrer con las flechas del teclado, confirmar con `Enter` y cerrar con `Escape`. Este componente es comun para Stock, Compras, POS y las demas selecciones operativas de articulos.

- Clientes y proveedores: codigo o numero interno, razon social, nombre de fantasia, DNI, CUIT u otro documento.
- Articulos: codigo interno, descripcion corta o ampliada, cualquier codigo de barras y cualquier codigo de proveedor.

Los futuros maestros deben seguir este mismo comportamiento e incorporar todos sus identificadores operativos relevantes.
# Acciones uniformes en los maestros

El listado de articulos muestra la accion **⚙ Detalles** para abrir la ficha completa. La eliminacion no se ofrece desde ese listado.

## Ordenamiento de listados

Las tablas de consulta, maestros e historicos que pueden crecer permiten ordenar al pulsar el encabezado de una columna. El primer toque ordena en forma ascendente, el segundo en forma descendente y el tercero recupera el orden original del listado. La flecha del encabezado identifica el estado actual.

Fechas y horas, cantidades, porcentajes e importes se comparan por su valor real; no se ordenan alfabeticamente. Las columnas vacias o de **Accion/Acciones** no se ofrecen como criterio. Las grillas usadas para cargar documentos, contar inventario o imputar pagos mantienen su orden operativo para evitar que una fila cambie de lugar mientras se escribe.

En articulos, la baja operativa se realiza desmarcando **Articulo activo**. Esto deshabilita tambien venta, compra e inventario y lo excluye de buscadores y selectores operativos, pero conserva su ficha e historial. La eliminacion fisica se ubicara en la ficha y solamente podra autorizarse si el registro no posee movimientos ni relaciones historicas.
