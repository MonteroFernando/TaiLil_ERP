# Acceso y seguridad

## Usuario inicial de instalacion

La primera instalacion crea un usuario administrador llamado `admin`. Su contraseña se toma del `.env` local y nunca se guarda en el repositorio.

Al ingresar por primera vez, el sistema obliga al administrador a reemplazar la contraseña inicial antes de continuar. La contraseña anterior deja de ser valida y no puede recuperarse.

## Flujo de primer acceso

1. El responsable tecnico ejecuta la migracion de base de datos.
2. Ejecuta el comando de creacion del administrador inicial.
3. El administrador ingresa con las credenciales temporales acordadas.
4. El sistema solicita una contraseña personal de al menos 10 caracteres.
5. Una vez cambiada, se muestra el panel principal.

## Sesiones

- Un acceso correcto crea una sesion identificable y revocable.
- Cerrar sesion invalida su renovacion.
- El acceso breve dura 15 minutos y puede renovarse durante 7 dias.
- Un usuario inactivo no puede iniciar una sesion nueva.

## Reglas actuales

- Los mensajes de error no revelan si un usuario existe.
- Las contraseñas se almacenan con hash Argon2id irreversible.
- El administrador inicial se crea una sola vez; repetir el comando no modifica su clave.
- La recuperacion por token temporal esta diseñada, pero se implementara cuando definamos el canal de correo.
