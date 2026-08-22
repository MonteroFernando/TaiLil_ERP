# Manual de usuario integrado

## Componentes

- `apps/web/src/manual/contenido.ts`: catálogo tipado de capítulos, requisitos, rutas, pasos, consejos y palabras clave.
- `apps/web/src/app/manual/page.tsx`: consulta de sesión, filtrado, búsqueda, navegación y generación del PDF.
- `apps/web/src/components/CapturaManual.tsx`: vistas guiadas reutilizables con datos demostrativos.
- `apps/web/src/components/NavegacionPrincipal.tsx`: acceso global **🧠 Manual**.
- `apps/web/src/app/globals.css`: presentación web, adaptable, oscura y preparada para captura en tema claro.

## Autorización

La pantalla ejecuta en paralelo:

- `GET /api/v1/autenticacion/yo`;
- `GET /api/v1/autenticacion/mis-permisos`.

`puedeVerSeccion` admite capítulos públicos para cualquier usuario autenticado, exclusivos de administrador, que requieren alguno de varios permisos o que requieren todos. El administrador recibe siempre todos los capítulos. No se creó una migración ni una tabla paralela de permisos.

El manual queda protegido por la autenticación global de `NavegacionPrincipal`. Una ruta funcional enlazada desde un capítulo continúa protegida por la misma matriz que el resto del ERP.

## Búsqueda

La búsqueda se normaliza a minúsculas y elimina tildes. Compara módulo, título, resumen, explicación, pasos, consejos y palabras clave. Solo busca dentro de las secciones ya autorizadas, por lo que no filtra ni revela nombres de funciones ocultas.

## Generación PDF

El navegador carga `jspdf` y `html2canvas` únicamente al solicitar la descarga. Una fuente fuera del área visible contiene todos los capítulos autorizados, independientemente del filtro de búsqueda. Cada capítulo se captura en tema claro, se agrega a una página A4 y recibe pie, usuario y numeración.

El PDF no se almacena en el servidor ni en la base de datos. Se construye localmente y se entrega como descarga. Esto evita historiales innecesarios, no expone permisos de otros usuarios y permite utilizar exactamente el contenido visible para la sesión actual.

## Mantenimiento

Al incorporar o cambiar un flujo:

1. actualizar el capítulo correspondiente en `contenido.ts`;
2. asignar el requisito de permiso real, nunca un nombre de perfil;
3. actualizar o agregar la vista guiada en `CapturaManual.tsx`;
4. comprobar el capítulo con un administrador y con un usuario restringido;
5. descargar el PDF en ambos casos y verificar portada, imágenes, páginas y texto;
6. ejecutar `npm run typecheck` y `npm run lint`.

Las vistas deben usar datos ficticios y no deben copiar información sensible de una base productiva.

