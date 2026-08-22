# Produccion en una red Windows

## Arquitectura

Los equipos de la red acceden solamente a `http://IP-DEL-SERVIDOR:3000`. Next.js escucha en todas las interfaces y reenvia `/api/v1` internamente a FastAPI. La API escucha solo en `127.0.0.1:8000` y PostgreSQL no necesita exponerse a los clientes.

No configure `NEXT_PUBLIC_API_URL` con `localhost:8000`. Debe omitirse o establecerse como `/api/v1`, porque `localhost` en el navegador representa la PC cliente.

## Preparacion en el servidor

Desde la raiz del proyecto:

```powershell
& ".\.venv\Scripts\python.exe" -m pip install -r ".\apps\api\requirements.txt"
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" upgrade head
cd apps\web
npm ci
npm run build
cd ..\..
```

En `.env`, utilice secretos largos y unicos, `APP_ENV=production` y `APP_DEBUG=false`. Mientras se use HTTP dentro de la LAN, `COOKIE_SECURE=false`; al incorporar HTTPS debe cambiarse a `true`.

## Arranque comprobable

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\Iniciar-TaiLilERP.ps1
```

El script detecta automaticamente la raiz, valida `.env`, el entorno virtual y el build, inicia la API internamente y publica el frontend en `0.0.0.0:3000`. Los registros quedan en `logs`.

Para detenerlo:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\Detener-TaiLilERP.ps1
```

## Inicio automatico con Windows

Abra PowerShell como administrador, reemplace la ruta y registre una tarea ejecutada como `SYSTEM`:

```powershell
$script = "C:\TaiLilERP\deploy\windows\Iniciar-TaiLilERP.ps1"
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$inicio = New-ScheduledTaskTrigger -AtStartup
$configuracion = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName "TaiLil ERP" -Action $accion -Trigger $inicio -Settings $configuracion -User "SYSTEM" -RunLevel Highest
Start-ScheduledTask -TaskName "TaiLil ERP"
```

El usuario `SYSTEM` debe tener lectura y ejecucion sobre la carpeta del proyecto. Se recomienda instalar la aplicacion en una ruta estable como `C:\TaiLilERP`, no dentro de una carpeta sincronizada.

## Firewall y direccion estable

Permita solamente el frontend en el perfil privado:

```powershell
New-NetFirewallRule -DisplayName "TaiLil ERP Web" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private
```

No abra los puertos `8000` ni `5432` para los puestos clientes. Reserve una IP fija para el servidor en el router o configure una reserva DHCP. Los clientes pueden entrar por IP, por ejemplo `http://192.168.1.62:3000`, o por el nombre del equipo, por ejemplo `http://NOMBRE-SERVIDOR:3000`, si la red resuelve nombres locales.

## Verificacion

En el servidor:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/v1/sistema/estado -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000/api/v1/sistema/estado -UseBasicParsing
Get-NetTCPConnection -State Listen -LocalPort 3000,8000
```

En otro equipo abra `http://IP-DEL-SERVIDOR:3000`. Si aparece la interfaz pero el ingreso no responde, pruebe `http://IP-DEL-SERVIDOR:3000/api/v1/sistema/estado`: debe responder a traves del mismo proxy.
