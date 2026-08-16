# Arquitectura

## Vista general

```text
Navegador
   |
Next.js :3000
   |
FastAPI :8000/api/v1
   |
PostgreSQL :5432
```

## Estructura

```text
apps/
  api/
    app/
      api/             Composicion general de rutas
      core/            Configuracion transversal
      infrastructure/  Base de datos e integraciones
      modules/         Modulos funcionales
    tests/
  web/
    src/app/           Rutas y layouts
    src/modules/       Logica visual por modulo
docs/
  funcional/           Procesos del negocio
  tecnica/             Arquitectura y operacion
```

Cada modulo backend puede incorporar `api`, `application`, `domain` e `infrastructure`. No se crearan capas vacias por anticipado; se agregaran cuando exista comportamiento real.

Cada modulo registra su propio `APIRouter`. `app/api/router.py` compone los routers y `app/main.py` monta la API bajo `/api/v1`.
