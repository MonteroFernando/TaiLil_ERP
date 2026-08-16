# Administracion de accesos

## Operaciones de usuario

```text
GET    /api/v1/administracion/accesos/usuarios
POST   /api/v1/administracion/accesos/usuarios
PUT    /api/v1/administracion/accesos/usuarios/{id}/accesos
POST   /api/v1/administracion/accesos/usuarios/{id}/restablecer-contrasena
DELETE /api/v1/administracion/accesos/usuarios/{id}
```

El `DELETE` implementa baja logica y revoca las sesiones. El restablecimiento reemplaza el hash, marca `debe_cambiar_contrasena=true` y también revoca todas las sesiones del usuario.

Todas las operaciones requieren un administrador autenticado. Las protecciones de autocambio se validan en el backend y no dependen de la interfaz.
