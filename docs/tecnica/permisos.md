# Permisos y perfiles

## Modelo RBAC

```text
usuarios -> usuarios_perfiles -> perfiles_acceso
                                  |
                                  v
                         perfiles_permisos -> permisos

usuarios -> usuarios_permisos -> permisos
```

El permiso efectivo es la union de perfiles activos y permisos directos. `es_administrador=true` concede acceso total para evitar que un administrador quede bloqueado al incorporar codigos nuevos.

## Catalogo vigente

```text
configuracion.accesos.ver
configuracion.accesos.gestionar
datos_maestros.ver
datos_maestros.gestionar
inventario.ver
inventario.gestionar
ventas.ver
ventas.gestionar
ventas.cuenta_corriente.configurar
compras.ver
compras.gestionar
tesoreria.ver
tesoreria.gestionar
informes.ver
```

Los codigos se crean con migraciones Alembic y las dependencias `requerir_permiso(...)` protegen cada endpoint. La navegacion frontend usa `GET /api/v1/autenticacion/mis-permisos`, pero nunca reemplaza la validacion del backend.

`20260821_0037` asigna los permisos de Tesoreria a perfiles de sistema. `20260821_0040` crea `informes.ver` y lo hereda inicialmente a los perfiles con `tesoreria.ver`; desde ese punto ambos pueden administrarse independientemente.

## API administrativa

Todos estos endpoints requieren administrador:

```text
GET  /api/v1/administracion/accesos/permisos
GET  /api/v1/administracion/accesos/perfiles
POST /api/v1/administracion/accesos/perfiles
PUT  /api/v1/administracion/accesos/perfiles/{id}
GET  /api/v1/administracion/accesos/usuarios
POST /api/v1/administracion/accesos/usuarios
PUT  /api/v1/administracion/accesos/usuarios/{id}/accesos
```
