# TaiLil ERP

Mini ERP fullstack modular construido con FastAPI, Next.js y PostgreSQL.

## Estado actual

- API FastAPI versionada en `/api/v1`.
- Aplicacion web Next.js con App Router.
- PostgreSQL preparado mediante Docker Compose.
- Configuracion local protegida mediante `.env`.
- Documentacion separada en una rama funcional y otra tecnica.
- Maestro de articulos con codigos numericos de cinco digitos, unidades, codigos de barras y referencias por proveedor.
- Maestro de proveedores con alta, busqueda, modificacion y control de estado.

## Documentacion

- [Documentacion funcional](docs/funcional/README.md): alcance, lenguaje del negocio y modulos.
- [Documentacion tecnica](docs/tecnica/README.md): arquitectura, instalacion y decisiones de implementacion.

## Inicio rapido

Los pasos completos estan en [Instalacion y ejecucion](docs/tecnica/instalacion.md).

```powershell
cd apps/web
npm install
npm run dev
```

Con el entorno virtual del backend activo:

```powershell
pip install -r apps/api/requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir apps/api
```

- Web: `http://localhost:3000`
- Web desde la red local: `http://IP-DEL-SERVIDOR:3000`
- API: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/docs`
- Estado: `http://localhost:8000/api/v1/sistema/estado`

Primera instalacion de la base:

```powershell
python -m alembic -c apps/api/alembic.ini upgrade head
cd apps/api
python -m app.scripts.crear_administrador_inicial
```

## Convenciones principales

- El dominio y la base de datos se expresan en español.
- Los identificadores usan `snake_case`, sin tildes ni caracteres especiales.
- Las contraseñas se almacenaran como hashes Argon2id irreversibles.
- La recuperacion permite definir una clave nueva; nunca recuperar la anterior.
- Los secretos reales solo viven en `.env`, excluido de Git.
