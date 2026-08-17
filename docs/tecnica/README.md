# Documentacion tecnica

- [Produccion en una red Windows](produccion-red-windows.md)

- [Clasificadores, almacenes y stock](clasificadores-almacenes-stock.md)
- [Listas de precios](listas-de-precios.md)
- [Patron tecnico de busquedas en maestros](patron-busquedas-maestros.md)
- [Cuenta corriente de ventas](cuenta-corriente-ventas.md)
- [Punto de venta](punto-de-venta.md)

Esta rama explica la arquitectura, instalacion, seguridad y decisiones necesarias para desarrollar y operar TaiLil ERP.

## Indice

- [Arquitectura](arquitectura.md)
- [Instalacion y ejecucion](instalacion.md)
- [Base de datos](base-de-datos.md)
- [Autenticacion y seguridad](autenticacion.md)
- [Permisos y perfiles](permisos.md)
- [Maestro de articulos](maestro-articulos.md)

## Tecnologias base

- Backend: Python, FastAPI, Pydantic, SQLAlchemy y Alembic.
- Frontend: TypeScript, React, Next.js App Router y Tailwind CSS.
- Persistencia: PostgreSQL.
- Desarrollo local: `.venv`, npm y Docker Compose.
- API REST bajo `/api/v1`.

Se utiliza un monolito modular: cada area tiene limites explicitos, pero todos los modulos se despliegan inicialmente como una sola API y comparten PostgreSQL.
