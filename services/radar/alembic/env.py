import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BASE_DIR, ".env"))

from app.models import Base  # noqa: E402,F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
SCHEMA = "radar"
DATABASE_URL = (
    os.getenv("RADAR_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
)


def include_object(obj, name, type_, reflected, compare_to):
    """Migratiile serviciului ating doar schema `radar`; restul bazei nu e treaba lui."""
    if type_ == "table":
        return (obj.schema or "public") == SCHEMA
    return True


_OPTS = dict(
    target_metadata=target_metadata,
    version_table_schema=SCHEMA,
    include_schemas=True,
    include_object=include_object,
    compare_type=True,
)


def run_migrations_offline() -> None:
    context.configure(url=DATABASE_URL, literal_binds=True,
                      dialect_opts={"paramstyle": "named"}, **_OPTS)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    # Why: tabelul alembic_version trăiește tot in schema `radar`, deci schema
    # trebuie sa existe inainte de prima migratie.
    if connection.dialect.name == "postgresql":
        connection.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
        connection.commit()
    context.configure(connection=connection, **_OPTS)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(DATABASE_URL)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
