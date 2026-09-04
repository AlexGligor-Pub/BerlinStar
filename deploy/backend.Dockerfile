FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

# Instalare dependințe (layer separat pentru cache)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --timeout 120 -r requirements.txt

# Copiază codul backend
COPY backend/ .

# Copiază entrypoint
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
