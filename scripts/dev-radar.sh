#!/usr/bin/env bash
# Porneste local (fara Docker) API-ul Radar pe :4100 si worker-ul, din services/radar/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVC="$ROOT/services/radar"
VENV="$SVC/venv/bin"
LOGS="/tmp/claude-logs"

[ -x "$VENV/uvicorn" ] || { echo "Lipseste $VENV/uvicorn — creeaza venv-ul: python3 -m venv $SVC/venv && $VENV/pip install -r $SVC/requirements.txt"; exit 1; }
mkdir -p "$LOGS"

cd "$SVC"
"$VENV/uvicorn" app.main:app --reload --port 4100 >"$LOGS/radar-api.log" 2>&1 &
API_PID=$!
"$VENV/python" -m app.worker >"$LOGS/radar-worker.log" 2>&1 &
WORKER_PID=$!

echo "radar-api    pid=$API_PID    http://localhost:4100  log=$LOGS/radar-api.log"
echo "radar-worker pid=$WORKER_PID                        log=$LOGS/radar-worker.log"
echo "Oprire: kill $API_PID $WORKER_PID"
