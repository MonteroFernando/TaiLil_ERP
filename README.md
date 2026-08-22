# Morita sobre TaiLil ERP

ERP modular para operación comercial, inventario, compras, ventas, cuentas corrientes, tesorería e informes, construido con FastAPI, Next.js y PostgreSQL.

## Estado actual

- API FastAPI versionada en `/api/v1`.
- Aplicacion web Next.js con App Router.
- PostgreSQL preparado mediante Docker Compose.
- Configuracion local protegida mediante `.env`.
- Identidad Morita, temas claro y oscuro y navegación protegida por permisos.
- Maestros de artículos y socios, stock histórico, inventarios y compras con MRP simple.
- POS con escaneo, cuenta corriente explícita, notas de crédito e impresión directa.
- Tesorería con conciliación muchos a muchos, arqueos y calendario de cierres.
- Informes de flujo, ventas, costos y márgenes con exportación numérica a Excel.
- Esquema vigente: `20260822_0045 (head)`.

## Documentacion

- [Estado actual completo](docs/ESTADO_ACTUAL.md): fotografía funcional y técnica de la versión vigente.
- [Guía operativa integral](docs/funcional/guia-operativa-integral.md): recorrido diario de punta a punta.
- [Documentacion funcional](docs/funcional/README.md): alcance, lenguaje del negocio y modulos.
- [Documentacion tecnica](docs/tecnica/README.md): arquitectura, instalacion y decisiones de implementacion.
- [Procedimiento PowerShell](PASOS_ACTUALIZAR_Y_ARRANCAR.txt): migrar, compilar y arrancar sin perder datos.

## Inicio rapido

Los pasos completos estan en [Instalacion y ejecucion](docs/tecnica/instalacion.md).

```powershell
cd apps/web
npm install
npm run dev
```

Desde la raiz, usando explicitamente el Python del entorno virtual:

```powershell
& ".\.venv\Scripts\python.exe" -m pip install -r ".\apps\api\requirements.txt"
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir ".\apps\api"
```

- Web: `http://localhost:3000`
- Web desde la red local: `http://IP-DEL-SERVIDOR:3000`
- API: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/docs`
- Estado: `http://localhost:8000/api/v1/sistema/estado`

Primera instalacion de la base:

```powershell
& ".\.venv\Scripts\python.exe" -m alembic -c ".\apps\api\alembic.ini" upgrade head
Push-Location ".\apps\api"
& "..\..\.venv\Scripts\python.exe" -m app.scripts.crear_administrador_inicial
Pop-Location
```

## Convenciones principales

- El dominio y la base de datos se expresan en español.
- Los identificadores usan `snake_case`, sin tildes ni caracteres especiales.
- Las contraseñas se almacenaran como hashes Argon2id irreversibles.
- La recuperacion permite definir una clave nueva; nunca recuperar la anterior.
- Los secretos reales solo viven en `.env`, excluido de Git.
