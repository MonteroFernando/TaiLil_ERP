# Permisos y perfiles

## Modelo RBAC

La autorizacion combina perfiles reutilizables con permisos directos adicionales:

```text
usuarios -> usuarios_perfiles -> perfiles_acceso
                                  |
                                  v
                         perfiles_permisos -> permisos

usuarios -> usuarios_permisos -> permisos
```

El permiso efectivo es la union de los permisos de todos los perfiles activos y los permisos directos. `es_administrador=true` funciona como acceso total y evita que un administrador quede bloqueado cuando se incorporan permisos nuevos.

## Codigos

Formato: `<modulo>.<recurso-o-area>.<accion>` o `<modulo>.<accion>`.

Ejemplos:

```text
configuracion.accesos.ver
configuracion.accesos.gestionar
inventario.ver
inventario.gestionar
```

Los codigos se crean mediante migraciones, no desde la interfaz. Esto permite revisar cada permiso junto con el codigo que protege.

## API administrativa

Todos los endpoints requieren `es_administrador=true`:

```text
GET  /api/v1/administracion/accesos/permisos
GET  /api/v1/administracion/accesos/perfiles
POST /api/v1/administracion/accesos/perfiles
PUT  /api/v1/administracion/accesos/perfiles/{id}
GET  /api/v1/administracion/accesos/usuarios
POST /api/v1/administracion/accesos/usuarios
PUT  /api/v1/administracion/accesos/usuarios/{id}/accesos
```

El usuario autenticado puede consultar sus permisos efectivos mediante `GET /api/v1/autenticacion/mis-permisos`. El frontend utilizara este resultado para navegación y visibilidad, pero la API siempre vuelve a validar la autorizacion; ocultar un boton nunca reemplaza la seguridad del backend.
