# Instalacion y ejecucion

## Requisitos

- Python 3.13 o superior.
- Node.js LTS; se recomienda Node 24 LTS.
- PostgreSQL 18 o Docker Desktop.
- Git.

En Windows, el backend instala `tzdata` como dependencia explicita. Python lo utiliza para resolver `America/Argentina/Buenos_Aires` y calcular correctamente el inicio de la jornada operativa.

## Configuracion

El archivo `.env` esta ignorado por Git. Completar localmente:

```dotenv
POSTGRES_PASSWORD=tu_contrasena
```

## Backend

Desde la raiz:

```powershell
py -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r ".\apps\api\requirements.txt"
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir ".\apps\api"
```

Antes del primer inicio, aplicar la base y crear el administrador:

```powershell
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" upgrade head
Push-Location ".\apps\api"
& "..\..\.venv\Scripts\python.exe" -m app.scripts.crear_administrador_inicial
Pop-Location
```

Pruebas:

```powershell
& ".\.venv\Scripts\python.exe" -m pytest ".\apps\api\tests"
```

## Frontend

```powershell
cd apps/web
npm install
npm run dev
```

El frontend escucha en `0.0.0.0:3000` y reenvia internamente `/api/v1` al backend local. Desde la misma PC se abre `http://localhost:3000`; desde otro equipo de la red se utiliza la IPv4 del servidor, por ejemplo `http://192.168.1.62:3000`.

El proxy evita configurar la IP del servidor dentro del navegador y mantiene FastAPI protegido en `127.0.0.1`. Si cambia la IPv4 de la PC, solamente cambia la direccion utilizada para abrir el sistema.

En Windows debe permitirse una conexion TCP entrante al puerto `3000` para el perfil de red privada. No se recomienda habilitarla para redes publicas.

El primer acceso solicita reemplazar la contraseña temporal del administrador.

## PostgreSQL con Docker

```powershell
docker compose up -d postgres
docker compose ps
```

Para detenerlo sin borrar datos:

```powershell
docker compose stop postgres
```

## Verificacion del equipo

Antes de una instalacion nueva, confirme que Node.js, npm, Python y Docker se encuentren disponibles en `PATH`. Esa comprobacion corresponde al equipo donde se desplegara el sistema y no describe necesariamente el servidor que actualmente esta en funcionamiento.

Para actualizar una instalacion existente sin perder datos, siga el procedimiento versionado en `PASOS_ACTUALIZAR_Y_ARRANCAR.txt`: primero realice el respaldo, luego ejecute Alembic mediante `.\.venv\Scripts\python.exe -m alembic` y finalmente inicie los servicios con los scripts PowerShell. No use el comando global `alembic` ni el Python global, porque pueden no tener instaladas las dependencias del proyecto.
