# Autenticacion y seguridad

## Diseño acordado

- Access token JWT de 15 minutos.
- Refresh token de 7 dias.
- Cookies `HttpOnly`, `SameSite` y `Secure` en produccion.
- Sesiones en PostgreSQL para permitir revocacion.
- Rotacion del refresh token.
- Hash irreversible de contraseñas con Argon2id.
- Recuperacion mediante token temporal de un solo uso, inicialmente de 30 minutos.

La contraseña original nunca se almacena ni puede restaurarse. La recuperacion permite establecer una nueva y puede invalidar las sesiones anteriores.

En desarrollo `COOKIE_SECURE=false` permite HTTP local. En produccion sera obligatorio HTTPS y `COOKIE_SECURE=true`.

Los secretos de aplicacion, JWT y recuperacion solo se guardan en el entorno de ejecucion; no se versionan.

## Tablas

- `usuarios`: credencial, estado y banderas administrativas.
- `sesiones`: hash del refresh token, vencimiento, revocacion y datos basicos del dispositivo.

El refresh token tampoco se guarda directamente: se persiste su hash SHA-256 para poder compararlo y revocarlo.

## Endpoints

```text
POST /api/v1/autenticacion/iniciar-sesion
POST /api/v1/autenticacion/renovar
POST /api/v1/autenticacion/cerrar-sesion
POST /api/v1/autenticacion/cambiar-contrasena
GET  /api/v1/autenticacion/yo
```

Los JWT viajan en cookies `HttpOnly`; no quedan disponibles para JavaScript del navegador.

## Instalacion inicial

Con el entorno virtual activo y desde la raiz:

```powershell
python -m alembic -c apps/api/alembic.ini upgrade head
python -m app.scripts.crear_administrador_inicial
```

Para el segundo comando, ejecutar desde `apps/api` o definir el directorio de la aplicacion:

```powershell
cd apps/api
python -m app.scripts.crear_administrador_inicial
```

El comando es idempotente: si el usuario ya existe, no cambia su contraseña ni sus permisos.
