# Operacion Windows, Alembic e impresion

## Ruta y componentes

La instalacion documentada utiliza:

```powershell
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
```

- API y Alembic: `$RaizTaiLil\apps\api`;
- frontend: `$RaizTaiLil\apps\web`;
- entorno Python: `$RaizTaiLil\.venv`;
- lanzadores: `$RaizTaiLil\deploy\windows`;
- logs: `$RaizTaiLil\logs`.

Si la instalacion real esta en otra carpeta, solo debe cambiarse `$RaizTaiLil`; no deben editarse los scripts para cada puesto.

## Actualizacion segura

Ejecutar en la PC servidor:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
Set-Location -LiteralPath $RaizTaiLil

& ".\deploy\windows\Detener-TaiLilERP.ps1" -RaizProyecto $RaizTaiLil

& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" current
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" heads
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" upgrade head
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" current

Push-Location ".\apps\web"
npm.cmd ci
npm.cmd run build
Pop-Location

& ".\deploy\windows\Iniciar-TaiLilERP.ps1" -RaizProyecto $RaizTaiLil

Invoke-WebRequest "http://127.0.0.1:8000/api/v1/sistema/estado" -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:3000/api/v1/sistema/estado" -UseBasicParsing
Get-NetTCPConnection -State Listen -LocalPort 3000,8000
```

El resultado final de `current` debe ser `20260822_0048 (head)`. `heads` debe mostrar una sola cabeza. Si PostgreSQL pertenece a `compose.yaml`, iniciar antes con `docker compose up -d postgres`; no ejecutar ese paso cuando la base es un servicio externo.

Alembic aplica cambios incrementales y conserva datos. No usar `drop`, recreacion de esquema, restauraciones ni `downgrade` como forma normal de actualizar. Antes de una reversa extraordinaria se requiere respaldo verificado y revision de incompatibilidades, en especial datos creados desde las migraciones `0037` a `0041`.

## Arranque y detencion

El script de detencion finaliza el proceso registrado y sus descendientes. Tambien revisa los puertos 8000 y 3000 para retirar procesos huerfanos solamente cuando la linea de comando pertenece a esta instalacion del ERP. Esto evita que una instancia anterior iniciada con recarga siga respondiendo despues de actualizar backend o base de datos.

Arrancar sin actualizar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
Set-Location -LiteralPath $RaizTaiLil
& ".\deploy\windows\Iniciar-TaiLilERP.ps1" -RaizProyecto $RaizTaiLil
```

Detener:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
Set-Location -LiteralPath $RaizTaiLil
& ".\deploy\windows\Detener-TaiLilERP.ps1" -RaizProyecto $RaizTaiLil
```

## Diagnostico

```powershell
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
Set-Location -LiteralPath $RaizTaiLil
Get-Content ".\logs\api-error.log" -Tail 100
Get-Content ".\logs\api.log" -Tail 100
Get-Content ".\logs\web-error.log" -Tail 100
Get-Content ".\logs\web.log" -Tail 100
```

Si Alembic falla, no iniciar la API con un esquema intermedio. Conservar la salida completa, revisar conectividad y credenciales, y comprobar nuevamente `current` y `heads` antes de reintentar.

## Impresion directa

1. Instalar el driver oficial y configurar la impresora predeterminada del puesto.
2. Configurar ancho de ticket o etiqueta y, si existe guillotina, el corte al finalizar trabajo o pagina.
3. Abrir el puesto:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$RaizTaiLil = "D:\Documentos\Proyectos\TaiLil_ERP\TaiLil_ERP"
Set-Location -LiteralPath $RaizTaiLil
& ".\deploy\windows\Abrir-TaiLilERP-POS.ps1" -Url "http://localhost:3000"
```

En una PC cliente se reemplaza `localhost` por la IP o nombre del servidor y se usa la ruta local donde se copio el proyecto/lanzador. El script abre Edge con `--kiosk-printing`; `window.print()` utiliza entonces la impresora predeterminada sin dialogo.

Primero se debe probar **Vista previa**, revisar ancho y margenes y verificar el corte. Luego se habilita **Impresion directa**. La preferencia queda en `localStorage` y se comparte entre POS y Etiquetas.

El navegador no envia comandos crudos al dispositivo. El driver es responsable del corte; si el hardware no tiene cortador, la impresion funciona pero no existe corte fisico posible.

Los mismos comandos, en formato de copiar y pegar, estan en [PASOS_ACTUALIZAR_Y_ARRANCAR.txt](../../PASOS_ACTUALIZAR_Y_ARRANCAR.txt) e [IMPRESION_DIRECTA_WINDOWS.txt](../../IMPRESION_DIRECTA_WINDOWS.txt).
