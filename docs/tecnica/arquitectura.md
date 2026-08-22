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
    public/            Marca y recursos estaticos
    src/app/           Rutas, layouts y estilos globales
    src/components/    Componentes operativos compartidos
    src/formato.ts     Formato numerico transversal
docs/
  ESTADO_ACTUAL.md     Foto consolidada de la version
  funcional/           Procesos del negocio
  tecnica/             Arquitectura y operacion
```

Cada modulo backend puede incorporar `api`, `application`, `domain` e `infrastructure`. No se crearan capas vacias por anticipado; se agregaran cuando exista comportamiento real.

Cada modulo registra su propio `APIRouter`. `app/api/router.py` compone los routers y `app/main.py` monta la API bajo `/api/v1`.

La interfaz consulta identidad y permisos antes de montar rutas protegidas. Next.js reenvia `/api/v1` a FastAPI y mantiene un unico origen desde el navegador. Los estilos globales definen la paleta Morita, el tema oscuro, formatos de controles y variantes de impresion.
