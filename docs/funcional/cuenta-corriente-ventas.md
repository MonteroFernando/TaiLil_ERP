# Cuenta corriente de clientes

La cuenta corriente se configura en la ficha de un socio con rol **Cliente**. Requiere `ventas.cuenta_corriente.configurar`; la consulta y operacion financiera se realizan desde Tesoreria con sus permisos propios.

## Condiciones de credito

- **Activa:** autoriza nuevas ventas financiadas.
- **Limite maximo de deuda:** deuda total permitida.
- **Limite por periodo:** consumo nuevo admitido por dia, semana o mes; nunca supera el limite total.
- **Dias maximos de deuda:** antiguedad tolerada para el documento impago mas antiguo.

La deuda actual es la suma de los saldos pendientes de ventas confirmadas. El credito disponible es el menor entre el remanente total y el remanente del periodo. Si la cuenta esta inactiva o existe deuda vencida, el credito autorizado disponible es cero; la deuda y el historial no se modifican.

## Saldo a favor y disponible total

El saldo a favor es la suma de cobros confirmados menos sus conciliaciones activas. Es un anticipo ya recibido, no una ampliacion del limite de credito. Por eso se mantiene utilizable aunque la cuenta este inactiva o tenga deuda vencida.

Las notas de credito cancelan primero el saldo de la venta original y cualquier excedente aumenta el saldo a favor disponible.

```text
disponible total = saldo a favor + credito autorizado disponible
```

El POS muestra siempre deuda, saldo a favor, credito autorizado y disponible total al seleccionar el cliente. Al confirmar, aplica automaticamente los cobros antiguos sin imputar a la nueva venta. Para usar credito, el operador debe elegir expresamente **CUENTA CORRIENTE** e indicar el remanente completo; pagar cero o dejar una diferencia ya no genera deuda automaticamente. El ticket identifica lo aplicado.

## Conciliacion

Un cobro puede conciliarse con varias ventas y una venta puede recibir varios cobros. Es posible conciliar al registrar el cobro o posteriormente desde **Tesoreria → Cuentas corrientes → Historial y conciliacion**. Si una primera aplicacion fue parcial, el mismo cobro puede volver a aplicarse sobre la misma venta hasta agotar alguno de los dos saldos; cada aplicacion conserva su propio importe, fecha y usuario. Una anulacion exige motivo y conserva toda la auditoria.

El listado general de Tesoreria muestra el limite total asignado, la deuda que lo ocupa, el porcentaje utilizado y el remanente general. Los totales de cabecera se recalculan con las cuentas visibles despues de buscar o filtrar. Este indicador no reemplaza el disponible operativo del POS, que tambien considera el limite del periodo y la antiguedad de la deuda.

Si el cliente está vinculado con una cuenta padre, Tesorería agrupa allí la deuda financiera del grupo. Esta vinculación no modifica la autorización de crédito: cada hijo conserva su configuración y se valida con su propia deuda, límites y vencimientos.

Para el procedimiento completo consultar [Tesoreria](tesoreria.md).
