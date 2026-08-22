# Documentacion de TaiLil ERP

Documentacion vigente al **22 de agosto de 2026**. Este indice es el punto de entrada para operacion, capacitacion, soporte y desarrollo.

## Estado consolidado

- [Estado actual de Morita sobre TaiLil ERP](ESTADO_ACTUAL.md)
- [Guia operativa integral](funcional/guia-operativa-integral.md)
- [Estado tecnico e integridad](tecnica/estado-implementacion-e-integridad.md)

## Manual funcional

- [Acceso y seguridad](funcional/acceso-y-seguridad.md)
- [Administracion de accesos](funcional/administracion-accesos.md)
- [Permisos y perfiles](funcional/permisos-y-perfiles.md)
- [Dashboard](funcional/dashboard.md)
- [Maestro de articulos](funcional/maestro-de-articulos.md)
- [Clientes y proveedores](funcional/maestro-clientes-proveedores.md)
- [Clasificadores, almacenes, stock e inventarios](funcional/clasificadores-almacenes-stock.md)
- [Busquedas comunes](funcional/patron-maestros-y-busquedas.md)
- [Compras](funcional/compras.md)
- [Rotacion y reposicion MRP](tecnica/compras-rotacion-mrp.md)
- [Listas de precios](funcional/listas-de-precios.md)
- [Punto de venta](funcional/punto-de-venta.md)
- [Cuenta corriente](funcional/cuenta-corriente-ventas.md)
- [Notas de credito](funcional/notas-de-credito.md)
- [Tesoreria, conciliaciones y caja](funcional/tesoreria.md)
- [Informes y exportacion Excel](funcional/informes-y-exportacion-excel.md)
- [Impresion de tickets y etiquetas](funcional/impresion-directa.md)

## Referencia tecnica

- [Indice tecnico](tecnica/README.md)
- [Estado de implementacion e integridad](tecnica/estado-implementacion-e-integridad.md)
- [Tesoreria](tecnica/tesoreria.md)
- [Cuenta corriente y credito](tecnica/cuenta-corriente-ventas.md)
- [Notas de credito](tecnica/notas-de-credito.md)
- [Informes y Excel](tecnica/informes-y-exportacion-excel.md)
- [Operacion Windows, Alembic e impresion](tecnica/operacion-windows-alembic-impresion.md)

## Procedimientos copiables

- [Actualizar la base y arrancar los servicios](../PASOS_ACTUALIZAR_Y_ARRANCAR.txt)
- [Configurar impresion directa en Windows](../IMPRESION_DIRECTA_WINDOWS.txt)

## Criterio de vigencia

La base de datos y la API son la fuente de verdad para saldos, permisos e historiales. Los cambios de estructura se realizan exclusivamente con Alembic; no se reemplazan tablas ni se borran datos para actualizar. Todo cambio funcional debe actualizar su manual funcional, su referencia tecnica y, si corresponde, el procedimiento operativo.
