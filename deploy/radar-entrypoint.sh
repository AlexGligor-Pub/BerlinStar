#!/bin/sh
set -e

if [ "$RADAR_ROLE" = "worker" ]; then
  # Alembic e idempotent, dar doua `upgrade head` porniti simultan se pot bloca
  # reciproc la primul boot; worker-ul lasa API-ul sa migreze primul.
  sleep 10
fi

echo "Waiting for PostgreSQL..."
until python -c "import asyncpg; import asyncio; asyncio.run(asyncpg.connect('$RADAR_DATABASE_URL'.replace('postgresql+asyncpg://', 'postgresql://')))" 2>/dev/null; do
  sleep 1
done

echo "Ensuring schema radar..."
python - <<'PY'
import asyncio, os, asyncpg

dsn = os.environ["RADAR_DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")

async def main():
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS radar")
    finally:
        await conn.close()

asyncio.run(main())
PY

echo "Running Alembic migrations..."
alembic upgrade head

if [ "$RADAR_ROLE" = "worker" ]; then
  echo "Starting Radar worker..."
  exec python -m app.worker
fi

echo "Starting Radar API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
