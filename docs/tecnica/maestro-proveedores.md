# Maestro de proveedores

## Persistencia

La tabla `proveedores` utiliza un UUID como clave tecnica y un `codigo` unico visible para el usuario. La normalizacion transversal convierte codigo y razon social a mayusculas antes del guardado.

Las relaciones con productos permanecen en `articulos_proveedores`; por eso cambiar o desactivar un proveedor no elimina sus referencias.

## API

```text
GET /api/v1/articulos/proveedores?buscar={texto}
POST /api/v1/articulos/proveedores
PUT /api/v1/articulos/proveedores/{proveedor_id}
```

La consulta requiere `datos_maestros.ver`. El alta y la modificacion requieren `datos_maestros.gestionar`.

## Interfaz

La ruta `/proveedores` contiene el alta, buscador, listado y edicion. El acceso se encuentra en el panel principal.
