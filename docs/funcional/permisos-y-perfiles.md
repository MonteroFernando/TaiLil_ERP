# Permisos y perfiles de acceso

Un **permiso** habilita una accion concreta. Un **perfil de acceso** agrupa permisos reutilizables para una funcion operativa. Un usuario puede tener varios perfiles y permisos adicionales directos; el acceso efectivo es la union de todos ellos.

Solo un administrador puede crear usuarios, crear o modificar perfiles y asignar accesos. El catalogo lo define el sistema: desde la pantalla se seleccionan codigos existentes, no se inventan permisos.

## Catalogo operativo

| Modulo | Consulta | Gestion |
|---|---|---|
| Accesos | `configuracion.accesos.ver` | `configuracion.accesos.gestionar` |
| Datos maestros | `datos_maestros.ver` | `datos_maestros.gestionar` |
| Inventario | `inventario.ver` | `inventario.gestionar` |
| Ventas y POS | `ventas.ver` | `ventas.gestionar` |
| Notas de credito de clientes | `ventas.ver` | `ventas.notas_credito.emitir` |
| Compras | `compras.ver` | `compras.gestionar` |
| Tesoreria | `tesoreria.ver` | `tesoreria.gestionar` |
| Informes | `informes.ver` | — |

La configuracion crediticia de clientes usa ademas `ventas.cuenta_corriente.configurar`.

### Perfil Cajero

Alembic crea el perfil de sistema **CAJERO** con solamente `ventas.caja.operar` y `ventas.caja.cerrar`. Al asignarlo a un usuario, este puede abrir su caja, buscar clientes y articulos, consultar precios de venta, registrar cobros y ventas, recuperar sus borradores, imprimir y cerrar su propia caja desde el POS.

El perfil no habilita Tesoreria, informes, compras, stock, maestros, listas de precios, etiquetas, notas de credito ni configuracion del POS. Tampoco permite ver o cerrar la caja de otra persona. No deben agregarse permisos amplios al usuario si se desea conservar esta limitacion.

La emision de N/C es una funcion sensible y separada. El permiso `ventas.notas_credito.emitir` no se entrega automaticamente a ningun perfil, ni siquiera a perfiles que ya administran ventas. Debe marcarse expresamente en **Configurar accesos** para el perfil o usuario autorizado. Los administradores conservan acceso total por diseño.

`informes.ver` es independiente: debe otorgarse a quienes puedan consultar flujo de dinero, costos y margenes. Al instalar la migracion se concede inicialmente a perfiles que ya tenian `tesoreria.ver`, pero el administrador puede separarlos despues.

## Administracion

En **Panel principal → Configurar accesos** se crean perfiles, se marcan permisos por modulo y se crean usuarios con perfiles preasignados. Todo usuario nuevo recibe una contraseña temporal y debe cambiarla. Un administrador no puede desactivarse ni quitarse a si mismo el acceso administrativo.

Para un operador de mostrador, se crea o edita el usuario y se marca el perfil **CAJERO**. No es necesario asignar manualmente permisos individuales.

La navegacion se construye solamente despues de conocer los permisos efectivos. Un modulo sin autorizacion no aparece como opcion ni como grupo vacio. Mientras se consultan los accesos tampoco se dibuja el contenido protegido, evitando que se vea fugazmente. Si el usuario escribe manualmente la direccion de un modulo no autorizado, la pantalla no se monta y vuelve al Panel principal.

El permiso de consulta utilizado por **Control de stock** y **Almacenes** es `inventario.ver`, igual que en la API. Ocultar menus o botones mejora la interfaz, pero la API vuelve a controlar el permiso en cada solicitud.
