# Manual de usuario integrado

## Objetivo

El ERP incluye un manual pensado para personas sin conocimientos de sistemas. Se abre desde el botón **🧠 Manual** ubicado sobre las opciones del menú principal.

La ayuda no es una copia fija para todos. Al abrirla consulta el usuario actual y `mis-permisos`; muestra únicamente los capítulos cuya operación está autorizada. Un administrador puede ver el contenido completo. El perfil **CAJERO**, por ejemplo, recibe la explicación del POS y del cierre de su caja, pero no la emisión de notas de crédito salvo que tenga el permiso específico.

## Uso

1. Pulsar **Manual** en el menú izquierdo.
2. Escribir una palabra o una pregunta breve en **Buscar en el manual**.
3. Elegir un capítulo en el índice.
4. Leer para qué sirve, observar la vista guiada y seguir los pasos numerados.
5. Pulsar **Abrir módulo** para ir a la función explicada.

Las imágenes son vistas guiadas fieles al diseño de Morita y utilizan datos demostrativos. No muestran información comercial real. Cada vista identifica campos, tablas, totales y acciones en la misma disposición conceptual del módulo.

La vista guiada de **Tesoreria** incluye posicion agrupada, limite asignado, credito ocupado, porcentaje de uso y disponible. Su procedimiento explica que los totales cambian con la busqueda o filtro y que una conciliacion parcial puede completarse posteriormente sin perder el primer registro.

Tambien explica como clasificar un retiro como gasto directo o pago a proveedor y como continuar posteriormente una conciliacion. La vista de **Informes** muestra la accion **Ver trazabilidad** y el mapa desde caja hasta comprobante relacionado; ambos contenidos se incluyen en el PDF cuando el usuario posee sus permisos.

## PDF personalizado

El botón **Descargar manual** genera el PDF en el navegador. El documento contiene:

- portada Morita;
- usuario para el cual fue preparado;
- fecha y hora de generación;
- solamente los capítulos habilitados por sus permisos actuales;
- vistas guiadas, instrucciones y advertencias;
- numeración de páginas y firma de TaiLil ERP.

La búsqueda activa no reduce el PDF: siempre se incluyen todos los capítulos autorizados. El archivo se descarga como `Manual_Morita_USUARIO.pdf` y no modifica información del ERP.

## Actualización de permisos

Si un administrador cambia los accesos, el usuario debe volver a iniciar sesión o recargar la aplicación. En la siguiente apertura del manual se recalculan los capítulos visibles. El manual no posee un permiso separado porque la ayuda debe estar disponible para todo usuario autenticado; la visibilidad de cada capítulo depende de los permisos funcionales existentes.
