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
ventas.caja.operar
ventas.caja.cerrar
ventas.notas_credito.emitir
ventas.cuenta_corriente.configurar
compras.ver
compras.gestionar
tesoreria.ver
tesoreria.gestionar
informes.ver
```

Los codigos se crean con migraciones Alembic. Las dependencias `requerir_permiso(...)` y `requerir_alguno_de(...)` protegen cada endpoint. La segunda permite conservar los permisos generales existentes y, a la vez, autorizar una operacion estrictamente acotada. La navegacion frontend usa `GET /api/v1/autenticacion/mis-permisos`, pero nunca reemplaza la validacion del backend.

`NavegacionPrincipal.tsx` mantiene una matriz central de prefijos y permisos. Antes de renderizar contenido protegido consulta en conjunto `/autenticacion/yo` y `/autenticacion/mis-permisos`, filtra el menu y valida la ruta actual. Los requisitos expresados como lista aceptan cualquiera de sus codigos; configuracion y configuracion POS siguen siendo exclusivas de administrador. Una ruta sin permiso muestra solamente el estado neutro de verificacion y se reemplaza por `/panel`, por lo que el modulo rechazado no llega a montar sus componentes ni ejecutar sus consultas.

`20260821_0037` asigna los permisos de Tesoreria a perfiles de sistema. `20260821_0040` crea `informes.ver` y lo hereda inicialmente a los perfiles con `tesoreria.ver`; desde ese punto ambos pueden administrarse independientemente.

`20260822_0042` crea `ventas.caja.operar`, `ventas.caja.cerrar` y el perfil de sistema **CAJERO**. El perfil contiene exclusivamente ambos permisos. Los perfiles que ya poseian `ventas.gestionar` heredan los permisos operativos para conservar compatibilidad; no se agregan permisos a usuarios ni se altera ningun historial.

`20260822_0044` crea `ventas.notas_credito.emitir`. No lo asigna automaticamente a perfiles ni usuarios: la autorizacion debe concederse expresamente desde **Configurar accesos**. El backend lo valida al confirmar toda N/C de cliente y el frontend solamente muestra **Emitir N/C** cuando el usuario lo posee. El perfil **CAJERO** permanece sin este permiso.

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
