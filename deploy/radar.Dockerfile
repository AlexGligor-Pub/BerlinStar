FROM python:3.11-slim

WORKDIR /app

# procps: `pgrep` pentru healthcheck-ul worker-ului (nu vine in python:3.11-slim).
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core procps && rm -rf /var/lib/apt/lists/*

# Instalare dependințe (layer separat pentru cache)
COPY services/radar/requirements.txt .
RUN pip install --no-cache-dir --timeout 120 -r requirements.txt

# Copiază codul serviciului Radar
COPY services/radar/ .

# Copiază entrypoint
COPY deploy/radar-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN useradd --system --uid 10001 --gid 0 --no-create-home --shell /usr/sbin/nologin radar \
  && chown -R 10001:0 /app
USER 10001

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
