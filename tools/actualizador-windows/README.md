# TaiLil ERP - Actualizador Windows

Utilidad grafica independiente para actualizar un clon de TaiLil ERP y mantenerlo servido en una red Windows.

## Instalacion

1. Abra `tools\actualizador-windows`.
2. Ejecute `Instalar-Actualizador.cmd`.
3. Acepte el permiso de administrador.
4. En la ventana, seleccione solamente la raiz del repositorio y la rama, normalmente `main`.

La utilidad se copia a `C:\ProgramData\TaiLilERP\Actualizador` y crea el acceso directo **TaiLil ERP - Actualizador** en el escritorio publico. La configuracion y los registros quedan fuera del repositorio, por lo que una actualizacion Git no los reemplaza.

## Quitar el servicio

El boton **Quitar servicio** solicita confirmacion y luego detiene frontend y backend, elimina la tarea `TaiLil ERP - Inicio automatico` y quita la regla privada `TaiLil ERP Web` del firewall. No elimina el repositorio, `.env`, PostgreSQL, la base de datos, los logs, las credenciales ni los respaldos. Despues de quitarlo, TaiLil ERP no volvera a iniciarse al reiniciar Windows.

Para instalar nuevamente el inicio automatico sin perder datos, pulse **Iniciar**. Tambien puede usar **Actualizar desde Git**, que reconstruye la integracion de Windows aun cuando no existan commits nuevos.

## Backup transportable

**Crear backup** solicita una ubicacion y un password de al menos 10 caracteres. Genera un archivo `.taililbackup` que contiene:

- dump completo y consistente de PostgreSQL;
- commit y rama Git de origen;
- version de PostgreSQL;
- fecha de creacion;
- checksum SHA-256 del dump.

El paquete se cifra con AES-256 y se firma para detectar un password incorrecto o cualquier alteracion. La creacion puede realizarse con TaiLil ERP funcionando. El `.env` no se incluye: el servidor destino conserva sus propias claves privadas y credenciales de conexion.

Guarde el password en un lugar seguro. No se almacena junto al archivo y no existe un mecanismo para recuperarlo.

## Restaurar en otro servidor

1. Prepare o actualice primero la PC destino.
2. Copie el archivo `.taililbackup` al servidor.
3. Pulse **Restaurar backup**, seleccione el archivo e ingrese su password.
4. Confirme el reemplazo de la base actual.

Antes del corte se validan cifrado, firma, checksum, formato PostgreSQL y compatibilidad del commit. La version PostgreSQL del destino debe ser igual o superior a la de origen. Luego el actualizador detiene TaiLil ERP, crea un dump preventivo de la base destino en `logs\respaldos`, restaura, ejecuta Alembic, inicia y verifica los servicios.

Si la restauracion o el arranque falla, intenta recuperar automaticamente el dump preventivo. Los archivos, motivos y resultados quedan registrados en los logs del actualizador.

## Backup diario automatico

**Programar diario** permite elegir:

- carpeta de destino;
- hora de ejecucion;
- cantidad de copias a conservar, entre 2 y 365;
- password de cifrado.

Registra la tarea de Windows `TaiLil ERP - Backup diario`, ejecutada como SYSTEM. Si la PC estaba apagada a la hora elegida, Windows la inicia cuando vuelve a estar disponible. Si coincide con una actualizacion, restauracion u otra copia, el bloqueo del actualizador evita operaciones simultaneas y la tarea reintenta hasta tres veces cada diez minutos.

Los archivos se nombran `TaiLilERP-Automatico-AAAAMMDD-HHMMSS.taililbackup`. La limpieza elimina solamente copias automaticas que superen la retencion configurada; los backups manuales y cualquier otro archivo quedan intactos.

El password queda cifrado mediante DPAPI para toda la maquina en `backup-diario.json`, cuyo acceso se restringe a administradores y SYSTEM. Debe guardarlo tambien fuera del servidor: sera necesario para restaurar las copias en otra PC.

**Quitar backup diario** elimina la tarea y su configuracion protegida, pero conserva todos los `.taililbackup` existentes. Esta tarea es independiente del inicio automatico del ERP.

## Preparar una PC servidor nueva

En una PC nueva indique la carpeta donde desea instalar el sistema, por ejemplo `C:\TaiLilERP`, seleccione la rama y pulse **Preparar nueva PC**. La carpeta puede no existir todavia. El asistente:

1. Comprueba Windows Package Manager (`winget`).
2. Instala, cuando faltan, Git para Windows, Node.js LTS, Python 3 y PostgreSQL.
3. Clona `https://github.com/MonteroFernando/TaiLil_ERP.git` en la rama elegida.
4. Crea `.env` para produccion con secretos aleatorios.
5. Crea la base `TaiLil_ERP` y el usuario administrador inicial.
6. Instala dependencias, compila el frontend y aplica Alembic.
7. Configura firewall privado, inicio automatico y verifica el servicio.

Las credenciales generadas quedan en `C:\ProgramData\TaiLilERP\Actualizador\credenciales-iniciales.txt`, con acceso restringido a administradores y SYSTEM. Abra el archivo al terminar, ingrese como `admin` y cambie su contraseña.

Si falta `winget`, instale **App Installer** desde Microsoft Store y vuelva a pulsar el boton. Algunos instaladores pueden requerir reiniciar Windows; la preparacion es reanudable y puede ejecutarse nuevamente sobre la misma carpeta.

Si PostgreSQL ya estaba instalado, el password declarado en el `.env` debe coincidir con el usuario local `postgres`. El asistente nunca cambia la contraseña de una base existente.

## Que hace Actualizar desde Git

1. Ejecuta `git fetch` sin modificar los archivos.
2. Cancela si hay cambios locales, una rama divergente o una configuracion invalida.
3. Si cambiaron migraciones, intenta crear un respaldo PostgreSQL mediante `pg_dump` antes del corte.
4. Detiene frontend y backend.
5. Aplica solamente una actualizacion fast-forward de la rama configurada.
6. Actualiza dependencias Python o Node cuando cambiaron sus manifiestos.
7. Genera el frontend de produccion. Conserva temporalmente el build anterior y lo restaura si falla la compilacion.
8. Ejecuta `alembic upgrade head` con el Python del entorno virtual.
9. Configura el inicio automatico de Windows y abre solamente el puerto web 3000 en redes privadas.
10. Inicia API y web, y comprueba ambos endpoints HTTP.

Los puestos acceden a `http://IP-DEL-SERVIDOR:3000`. La API permanece en `127.0.0.1:8000` y Next.js la publica mediante `/api/v1`; PostgreSQL no se expone a la red.

## Requisitos del servidor

- Windows PowerShell 5.1 o posterior.
- Windows Package Manager (`winget`) para instalar automáticamente los componentes que falten.
- Acceso autenticado a GitHub si el repositorio remoto es privado.

Git, Python, Node.js y PostgreSQL ya no necesitan instalarse manualmente en una PC limpia: el modo **Preparar nueva PC** los incorpora. En instalaciones existentes, el modo normal sigue respetando el PostgreSQL y el `.env` actuales.

## PCs cliente

Las PCs que solamente usan el ERP no ejecutan este actualizador ni necesitan instalar servicios. Acceden desde el navegador a `http://IP-DEL-SERVIDOR:3000`. El actualizador se instala unicamente en la PC que actuara como servidor.

## Seguridad y recuperacion

La utilidad nunca ejecuta `git reset --hard`, no borra cambios locales y no realiza downgrade de la base. Si falla una etapa, deja el error y la salida completa en `C:\ProgramData\TaiLilERP\Actualizador\logs`.
