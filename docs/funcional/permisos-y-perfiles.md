# Permisos y perfiles de acceso

## Conceptos

- **Permiso:** habilita una accion concreta dentro de un modulo, por ejemplo `inventario.ver`.
- **Perfil de acceso:** conjunto reutilizable de permisos. Representa una funcion operativa, como Ventas o Responsable de deposito.
- **Administrador:** usuario con acceso completo que puede crear usuarios y administrar sus accesos.
- **Permiso adicional:** excepcion asignada directamente a un usuario, ademas de sus perfiles.

Utilizamos “perfil de acceso” y no “puesto” porque un puesto pertenece a la estructura laboral, mientras que un perfil describe exclusivamente el acceso al sistema. Un usuario puede tener varios perfiles.

## Reglas

- Solo los administradores pueden crear usuarios.
- Solo los administradores pueden crear perfiles o asignar permisos.
- Los permisos se organizan por modulo y accion para facilitar su revision.
- El sistema define el catalogo de permisos; los administradores seleccionan permisos existentes, pero no inventan codigos nuevos.
- Todo usuario nuevo recibe una contraseña temporal y debe reemplazarla en el primer acceso.
- Un administrador no puede quitarse a si mismo su acceso administrativo ni desactivarse.

## Catalogo inicial

Los modulos iniciales son Configuracion, Datos maestros, Inventario, Ventas y Compras. Cada modulo comienza con acciones `ver` y `gestionar`. Se agregaran acciones mas especificas —por ejemplo aprobar o anular— cuando implementemos el proceso correspondiente.

## Configuracion

La pantalla administrativa se encuentra en **Panel principal → Configurar accesos**. Desde ella se pueden crear perfiles, seleccionar permisos por modulo y crear usuarios con perfiles preasignados.
