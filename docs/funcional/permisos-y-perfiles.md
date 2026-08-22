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
| Compras | `compras.ver` | `compras.gestionar` |
| Tesoreria | `tesoreria.ver` | `tesoreria.gestionar` |
| Informes | `informes.ver` | — |

La configuracion crediticia de clientes usa ademas `ventas.cuenta_corriente.configurar`.

`informes.ver` es independiente: debe otorgarse a quienes puedan consultar flujo de dinero, costos y margenes. Al instalar la migracion se concede inicialmente a perfiles que ya tenian `tesoreria.ver`, pero el administrador puede separarlos despues.

## Administracion

En **Panel principal → Configurar accesos** se crean perfiles, se marcan permisos por modulo y se crean usuarios con perfiles preasignados. Todo usuario nuevo recibe una contraseña temporal y debe cambiarla. Un administrador no puede desactivarse ni quitarse a si mismo el acceso administrativo.

Ocultar un menu o boton mejora la interfaz, pero la API vuelve a controlar el permiso en cada solicitud.
