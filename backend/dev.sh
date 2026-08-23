#!/usr/bin/env bash
# Pornirea/oprirea backendului in dezvoltare (WSL).
#
# De ce exista scriptul: pe mount-ul /mnt/c, `--reload` nu functioneaza —
# watcher-ul (nici inotify, nici polling) nu vede modificarile facute din
# Windows, deci serverul serveste cod vechi la nesfarsit. Mai rau, cand omori
# procesul reloader, worker-ul copil (spawnat cu multiprocessing) rămâne orfan
# si tine portul 4000: serverul pare pornit, accepta conexiuni TCP, dar nu mai
# raspunde la HTTP. Scriptul opreste intreg arborele inainte sa porneasca.
#
#   ./dev.sh start     porneste in fundal (log in /tmp/berlinstar-backend.log)
#   ./dev.sh stop      opreste tot, inclusiv worker-ii orfani
#   ./dev.sh restart   dupa modificari de cod (tine locul lui --reload)
#   ./dev.sh status    ce ruleaza si daca raspunde
#   ./dev.sh logs      urmareste log-ul
set -euo pipefail

cd "$(dirname "$0")"
PORT=4000
HOST=127.0.0.1
LOG=/tmp/berlinstar-backend.log

_pids() {
  # Reloader, worker-i spawnati si orice proces care tine portul.
  # `-a` + filtrare pe comm: altfel pgrep -f prinde si shell-ul din care rulam
  # (linia lui de comanda contine sirul cautat) si ne-am omori singuri.
  { pgrep -f "venv/bin/uvicorn app.main:app" | while read -r pid; do
      case "$(cat /proc/$pid/comm 2>/dev/null)" in bash|sh|zsh) ;; *) echo "$pid" ;; esac
    done
    pgrep -f "multiprocessing.spawn.*multiprocessing-fork" | while read -r pid; do
      case "$(cat /proc/$pid/comm 2>/dev/null)" in bash|sh|zsh) ;; *) echo "$pid" ;; esac
    done
    ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' \
      | grep -o 'pid=[0-9]*' | cut -d= -f2 || true
  } | sort -u
}

stop() {
  local pids
  pids=$(_pids)
  if [ -z "$pids" ]; then echo "backend: oprit deja"; return; fi
  echo "backend: opresc $(echo "$pids" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 2
  pids=$(_pids)
  # shellcheck disable=SC2086
  [ -n "$pids" ] && { kill -9 $pids 2>/dev/null || true; sleep 1; }
  echo "backend: oprit"
}

start() {
  if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
    echo "backend: portul $PORT e deja ocupat — ruleaza './dev.sh restart'"; exit 1
  fi
  set -a; . ./.env; set +a
  nohup venv/bin/uvicorn app.main:app --port "$PORT" --host "$HOST" > "$LOG" 2>&1 &
  echo "backend: pornit (log: $LOG)"
  for _ in $(seq 1 120); do
    sleep 1
    if curl -s -m 2 -o /dev/null "http://$HOST:$PORT/openapi.json"; then
      echo "backend: gata pe http://$HOST:$PORT"; return
    fi
  done
  echo "backend: nu a pornit in 120s — vezi $LOG"; tail -20 "$LOG"; exit 1
}

case "${1:-status}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)
    pids=$(_pids)
    [ -n "$pids" ] && echo "procese: $(echo "$pids" | tr '\n' ' ')" || echo "procese: niciunul"
    code=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/openapi.json" || true)
    echo "http: ${code:-000}"
    ;;
  logs)    tail -f "$LOG" ;;
  *) echo "folosire: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
