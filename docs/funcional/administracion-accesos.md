# Administracion de accesos

El modulo utiliza indices laterales para separar usuarios, perfiles y permisos.

En el indice Usuarios, cada fila muestra **⚙ Editar** y **Eliminar**. Editar abre una ventana emergente desde la que el administrador puede cambiar estado, tipo de usuario, perfiles, permisos individuales y contraseña temporal. Eliminar solicita confirmacion y desactiva el acceso sin borrar su historial.

El reseteo obliga al usuario a cambiar la contraseña en el siguiente ingreso y cierra sus sesiones activas. La opcion eliminar realiza una baja logica: desactiva el acceso y revoca sesiones, pero conserva el registro para auditoria. Un administrador no puede eliminarse ni quitarse a si mismo el rol de administrador.
