# Referencia tecnica

TaiLil ERP es un monolito modular con API FastAPI/SQLAlchemy, frontend Next.js/React y PostgreSQL. La API publica recursos bajo `/api/v1`; Alembic es el unico mecanismo autorizado para evolucionar el esquema.

## Plataforma

- [Arquitectura](arquitectura.md)
- [Instalacion y ejecucion](instalacion.md)
- [Produccion en red Windows](produccion-red-windows.md)
- [Operacion Windows, Alembic e impresion](operacion-windows-alembic-impresion.md)
- [Base de datos](base-de-datos.md)
- [Autenticacion y seguridad](autenticacion.md)
- [Permisos y perfiles](permisos.md)
- [Administracion de accesos](administracion-accesos.md)
- [Dashboard](dashboard.md)

## Dominio

- [Maestro de articulos](maestro-articulos.md)
- [Clientes y proveedores](maestro-clientes-proveedores.md)
- [Proveedores](maestro-proveedores.md)
- [Busquedas en maestros](patron-busquedas-maestros.md)
- [Clasificadores, almacenes, stock e inventarios](clasificadores-almacenes-stock.md)
- [Compras](compras.md)
- [Listas de precios](listas-de-precios.md)
- [Punto de venta](punto-de-venta.md)
- [Etiquetas](etiquetas-precios.md)
- [Cuenta corriente y credito](cuenta-corriente-ventas.md)
- [Notas de credito](notas-de-credito.md)
- [Tesoreria](tesoreria.md)
- [Informes y Excel](informes-y-exportacion-excel.md)

Toda operacion financiera o de stock debe ser atomica, conservar usuario y fecha, y utilizar documentos compensatorios o estados de anulacion en vez de borrar historicos.
