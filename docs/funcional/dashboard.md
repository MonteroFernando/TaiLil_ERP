# Resumen principal

El panel principal concentra indicadores de distintos modulos sin mezclar sus responsabilidades. Cada usuario ve solamente la informacion autorizada por sus permisos.

Los ultimos movimientos son una seccion comun y se filtraran por la actividad del usuario. Ventas del dia pertenece a Ventas; existencias y almacenes a Stock; gastos a Finanzas; cashflow, ingresos y egresos a Tesoreria.

Las tarjetas toman datos reales de los modulos implementados y respetan sus permisos. No se generan importes ni cantidades ficticias cuando el usuario no tiene acceso o no existen movimientos.
