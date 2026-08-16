from asyncio import run
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.infrastructure.database  # noqa: F401
from app.core.config import configuracion
from app.infrastructure.database.base import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option(
    "sqlalchemy.url",
    configuracion.url_base_datos.render_as_string(hide_password=False).replace("%", "%%"),
)
target_metadata = Base.metadata


def ejecutar_migraciones_sin_conexion() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def configurar_migraciones(conexion) -> None:
    context.configure(connection=conexion, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def ejecutar_migraciones_con_conexion() -> None:
    motor = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with motor.connect() as conexion:
        await conexion.run_sync(configurar_migraciones)
    await motor.dispose()


if context.is_offline_mode():
    ejecutar_migraciones_sin_conexion()
else:
    run(ejecutar_migraciones_con_conexion())
