# Documentacion funcional

- [Clasificadores, almacenes y stock](clasificadores-almacenes-stock.md)
- [Listas de precios](listas-de-precios.md)
- [Patron general de maestros y busquedas](patron-maestros-y-busquedas.md)
- [Cuenta corriente de ventas](cuenta-corriente-ventas.md)
- [Punto de venta](punto-de-venta.md)

Esta rama explica TaiLil ERP desde el punto de vista de las personas usuarias y del negocio, sin detalles de programacion.

## Objetivo

Centralizar la informacion operativa de TaiLil y brindar una base ordenada para incorporar procesos sin perder claridad ni trazabilidad.

## Modulos previstos

1. **Acceso y seguridad:** usuarios, sesiones, recuperacion, roles y permisos.
2. **Empresas:** datos legales, establecimientos y configuracion operativa.
3. **Datos maestros:** productos, unidades de medida y estructuras compartidas.
4. **Inventario:** depositos, existencias, movimientos y ajustes.
5. **Ventas:** clientes, pedidos y comprobantes.
6. **Compras:** proveedores, ordenes y recepciones.
7. **Procesos:** importaciones, sincronizaciones y seguimiento de trabajos.

Estos modulos, salvo el estado tecnico del sistema, estan planificados pero todavia no implementados. Cada uno se documentara antes o junto con su desarrollo.

## Principios funcionales

- Una operacion debe tener un responsable y una fecha identificables.
- Los documentos comerciales conservaran su historial.
- Los permisos se definiran por accion y modulo.
- La interfaz y los mensajes para usuarios estaran en español.
- Los terminos del sistema deben coincidir con el vocabulario utilizado por TaiLil.

## Proximo documento funcional

El primer modulo implementado es [Acceso y seguridad](acceso-y-seguridad.md), con administrador inicial, sesiones y cambio obligatorio de contraseña.

El modelo de autorizacion se documenta en [Permisos y perfiles de acceso](permisos-y-perfiles.md).

El primer modulo operativo es el [Maestro de articulos](maestro-de-articulos.md).

La proxima definicion funcional pendiente corresponde a roles, permisos y politica de bloqueo por intentos fallidos.
