# Cuenta corriente de ventas

La cuenta corriente se configura dentro de la ficha de un socio que tenga rol **Cliente**. Puede completarse durante el alta integral o modificarse posteriormente por un usuario autorizado.

## Condiciones

- **Activa/Inactiva:** determina si el cliente puede operar con cuenta corriente.
- **Limite maximo de deuda:** saldo total financiado que el cliente nunca puede superar.
- **Limite por temporalidad:** credito nuevo permitido dentro de un periodo diario, semanal o mensual. Nunca puede superar el limite maximo de deuda.
- **Dias maximos de deuda:** antiguedad permitida para la deuda impaga.

Cuando se implemente el flujo de comprobantes y pagos, el sistema tomara la fecha de la deuda impaga mas antigua. Si supera los dias configurados, bloqueara automaticamente nuevas operaciones a cuenta corriente. El bloqueo no modifica ni elimina la deuda.

La configuracion requiere el permiso independiente `ventas.cuenta_corriente.configurar`. Los administradores poseen esta facultad y pueden otorgarla a usuarios o perfiles autorizados.
