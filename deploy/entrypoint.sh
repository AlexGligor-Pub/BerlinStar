#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until python -c "import asyncpg; import asyncio; asyncio.run(asyncpg.connect('$DATABASE_URL'.replace('postgresql+asyncpg://', 'postgresql://')))" 2>/dev/null; do
  sleep 1
done

echo "Running Alembic migrations..."
alembic upgrade heads

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
