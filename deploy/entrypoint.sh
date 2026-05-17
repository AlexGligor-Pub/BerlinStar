#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until python -c "import asyncpg; import asyncio; asyncio.run(asyncpg.connect('$DATABASE_URL'.replace('postgresql+asyncpg://', 'postgresql://')))" 2>/dev/null; do
  sleep 1
done

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting server..."
# IMPORTANT: -w 1 — broadcaster.py is in-memory; cu workers > 1 evenimentele
# SSE nu se propaga intre procese. Pentru ~200 utilizatori, 1 worker async
# este suficient. Migreaza la Redis pub/sub daca cresti workerii.
exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  -w 1 \
  --bind 0.0.0.0:8000 \
  --worker-connections 1000 \
  --timeout 600 \
  --graceful-timeout 30 \
  --max-requests 2000 \
  --max-requests-jitter 200 \
  --preload \
  --access-logfile -
