# Instalacion y ejecucion

## Requisitos

- Python 3.13 o superior.
- Node.js LTS; se recomienda Node 24 LTS.
- PostgreSQL 18 o Docker Desktop.
- Git.

## Configuracion

El archivo `.env` esta ignorado por Git. Completar localmente:

```dotenv
POSTGRES_PASSWORD=tu_contrasena
```

## Backend

Desde la raiz:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e "apps/api[dev]"
uvicorn app.main:app --reload --app-dir apps/api
```

Antes del primer inicio, aplicar la base y crear el administrador:

```powershell
python -m alembic -c apps/api/alembic.ini upgrade head
cd apps/api
python -m app.scripts.crear_administrador_inicial
cd ../..
```

Pruebas:

```powershell
pytest apps/api/tests
```

## Frontend

```powershell
cd apps/web
npm install
npm run dev
```

Abrir `http://localhost:3000`.

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

## Estado inicial del equipo

Node.js y npm estaban disponibles. Python y Docker no estaban instalados o no se encontraban en `PATH`; deben instalarse antes de ejecutar la API y PostgreSQL mediante Docker.
