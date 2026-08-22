# Base de datos

## Revision vigente

La cadena de migraciones aplicada llega a `20260822_0048 (head)`. Alembic es el unico mecanismo autorizado para modificar estructura o completar datos derivados durante una actualizacion. La revision `0046` habilita conciliaciones parciales por tramos; la `0047` agrega trazabilidad a retiros de caja; y la `0048` agrega letra, POI y numero a facturas de proveedor. La ultima revision separa comprobantes historicos reconocibles y conserva la referencia original cuando no puede interpretarla. Ninguna borra documentos financieros existentes.

Las actualizaciones normales son incrementales y conservan datos. Esto no reemplaza el respaldo operativo de PostgreSQL: antes de actualizar un servidor productivo debe existir una copia recuperable independiente del volumen o servicio en uso.

## Normalizacion de textos

Los textos de negocio se almacenan en mayusculas. Los campos de correo electronico son la excepcion: se excluyen de la conversion global y se guardan normalizados en minusculas.

## Conexion local

- Motor: PostgreSQL.
- Base: `TaiLil_ERP`.
- Usuario local: `postgres`.
- Puerto: `5432`.
- Contraseña: definida exclusivamente en `.env`.

La aplicacion construye la URL mediante `sqlalchemy.URL.create`, evitando duplicar la contraseña y escapando correctamente sus caracteres especiales.

## Idioma y nombres

Las tablas, columnas, claves, restricciones, indices y migraciones del dominio se nombran en español.

- Utilizar `snake_case`.
- No utilizar tildes, espacios ni `ñ` en identificadores.
- Claves primarias: `id`.
- Claves foraneas: `<entidad>_id`.
- Auditoria: `fecha_creacion` y `fecha_modificacion`.

Ejemplos: `usuarios`, `empresas`, `productos`, `usuario_id`, `inventario_movimientos`.

Las tablas de autorizacion iniciales son `permisos`, `perfiles_acceso`, `perfiles_permisos`, `usuarios_perfiles` y `usuarios_permisos`.

Los nombres exigidos por protocolos o librerias pueden permanecer en ingles. Toda modificacion del esquema se realizara con Alembic y quedara versionada.

Los documentos financieros, ventas, movimientos, arqueos y cierres no deben corregirse mediante `DELETE` o edicion manual. Se utilizan estados, anulaciones con motivo, notas de credito, ajustes o documentos compensatorios. Las claves foraneas `RESTRICT` evitan eliminar maestros que ya poseen historial.
