# Autenticacion y seguridad

## Presentación de marca

La pantalla `/acceso`, los metadatos del sitio y `NavegacionPrincipal` identifican la aplicación como **Morita**. El recurso versionado se encuentra en `apps/web/public/brand/morita-logo.jpeg`; de esta forma la interfaz no depende de una ruta externa o de la computadora donde se obtuvo la imagen.

La paleta se centraliza mediante variables CSS en `apps/web/src/app/globals.css`: `--marca`, `--marca-oscura`, `--marca-media`, `--marca-hover`, `--marca-clara`, `--acento-calido`, `--acento-calido-claro`, `--crema`, `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--borde` y las sombras de marca. Las reglas globales normalizan los utilitarios verdes y blancos preexistentes para que todas las pantallas adopten el tema sin duplicar valores hexadecimales; los colores semánticos de error y advertencia permanecen independientes. La firma de TaiLil/Fernando es informativa y no interviene en el flujo de autenticación.

`SelectorTema` cambia el atributo `data-tema` del elemento `html` y persiste `claro` u `oscuro` en la clave local `morita.tema`. Un script temprano en el layout restaura el atributo antes de pintar la aplicación para evitar un destello del tema claro. El selector se presenta primero en la navegación y también sobre `/acceso`; no requiere sesión ni comunicación con la API. Las reglas `@media print` restablecen una paleta clara para conservar la legibilidad y el consumo de tinta de tickets, etiquetas e informes.

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

## Contraste de controles

Los estilos globales de `select option:checked`, foco de formularios y las utilidades `bg-[var(--marca-clara)]` garantizan contraste en modo oscuro. `BuscadorArticulo` expone sus resultados como `listbox`, y cada resultado usa `role="option"` con `aria-selected` para sincronizar el resaltado visual y el estado accesible.
