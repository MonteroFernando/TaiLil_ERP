# Impresion de tickets y etiquetas

El POS y Etiquetas comparten una seleccion persistente por navegador:

- **Vista previa** abre la impresion normal y permite elegir impresora;
- **Impresion directa** envia el trabajo al confirmar, siempre que el puesto haya sido abierto con el lanzador de impresion directa.

En el POS, despues de cobrar correctamente, se genera el ticket con sus medios y conciliaciones. En Etiquetas se imprime la composicion preparada. La impresion ocurre despues de la confirmacion: un problema de impresora no revierte ni duplica la venta.

Para evitar el dialogo de Windows se debe abrir Microsoft Edge con `deploy/windows/Abrir-TaiLilERP-POS.ps1`, que usa el modo `--kiosk-printing`, y configurar la impresora correcta como predeterminada.

El corte se configura en el driver oficial: **cortar al finalizar trabajo** para tickets o **cortar al finalizar pagina/etiqueta** cuando el equipo de etiquetas lo soporte. El navegador no envia comandos ESC/POS, ZPL o TSPL en crudo; el driver traduce el fin del trabajo al corte apropiado. Un equipo sin cortador fisico no puede ejecutar esa accion.

La instalacion, prueba y comandos de apertura estan detallados en [Operacion Windows, Alembic e impresion](../tecnica/operacion-windows-alembic-impresion.md) y en el procedimiento copiable [IMPRESION_DIRECTA_WINDOWS.txt](../../IMPRESION_DIRECTA_WINDOWS.txt).
