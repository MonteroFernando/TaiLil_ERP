# Acceso y seguridad

## Identidad visual

El ingreso y la navegación principal muestran la marca **Morita Drugstore**. La interfaz utiliza como tema general el verde oscuro del logotipo, fondos cálidos crema y superficies claras para mantener contraste y legibilidad. La identidad se extiende a botones principales y secundarios, campos, buscadores, tarjetas, pestañas, tablas, modales, estados activos, focos de teclado y barras de desplazamiento. El rojo y el ámbar se reservan para deudas, errores y advertencias operativas.

En ambos temas, los campos desplegables muestran la opcion elegida con fondo y texto contrastantes. Las búsquedas dinámicas resaltan con un borde verde visible el resultado recorrido mediante las flechas. El foco de inputs, selects y áreas de texto utiliza un anillo más luminoso en modo oscuro.

Debajo del logotipo se conserva, en tamaño discreto, la autoría del sistema: **Power by TaiLil ERP** y **TaiLil Soluciones Tecnológicas by Fernando Montero**. Cuando el menú lateral se contrae, se muestra únicamente el símbolo vegetal de Morita para aprovechar el espacio disponible.

El botón ubicado en la parte superior permite alternar en cualquier momento entre **Modo oscuro** y **Modo claro**. También está disponible en el ingreso. La selección queda guardada en ese navegador y se recupera automáticamente al volver a abrir el sistema. El modo elegido no modifica tickets, etiquetas ni otras impresiones: estos documentos continúan generándose con fondo blanco.

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
