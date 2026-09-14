#!/usr/bin/env bash
# Deploy PRODUCTIE BerlinStar: git pull (MainProd) + rebuild + restart + agent-bridge + verificare.
# Ruleaza pe serverul de productie:  ~/berlinstar/deploy-prod.sh
#
# Diferente fata de deploy-qa.sh:
#   - NU foloseste docker-compose.qa.yml (Caddy + TLS pornesc, DB nu e expus)
#   - NU suprascrie .env (foloseste deploy/.env de productie, care trebuie sa existe)
#   - reporneste si agent-bridge (systemd --user) daca e instalat
set -euo pipefail

REPO="${REPO:-$HOME/berlinstar}"
BRANCH="${BRANCH:-MainProd}"
DOMAIN="professorprime.ro"
DC="docker compose -f docker-compose.yml"

BRIDGE_SERVICE="berlinstar-agent-bridge"
BRIDGE_ENV="$HOME/.config/berlinstar-agent-bridge.env"
BRIDGE_VENV="$HOME/agent-bridge-venv"

cd "$REPO"

echo "==> verificari preliminare"
[ -f deploy/.env ] || { echo "   LIPSESTE deploy/.env — creeaza-l din deploy/.env.example"; exit 1; }
for v in POSTGRES_PASSWORD SECRET_KEY ASSISTANT_BRIDGE_URL ASSISTANT_BRIDGE_SECRET; do
  grep -qE "^${v}=.+" deploy/.env || echo "   ATENTIE: $v lipseste sau e gol in deploy/.env"
done

echo "==> git pull ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "   commit: $(git log -1 --oneline)"

cd "$REPO/deploy"

echo "==> rebuild + restart containere"
$DC up -d --build

echo "==> astept backend healthy"
for i in $(seq 1 60); do
  st="$($DC ps backend --format '{{.Health}}' 2>/dev/null || true)"
  [ "$st" = "healthy" ] && { echo "   backend: healthy"; break; }
  [ "$st" = "unhealthy" ] && { echo "   backend: UNHEALTHY — verifica logurile: cd deploy && $DC logs backend"; break; }
  [ "$i" = 60 ] && echo "   backend: inca nu e healthy dupa 2 min (stare: ${st:-necunoscuta})"
  sleep 2
done

echo "==> agent-bridge"
if systemctl --user list-unit-files "$BRIDGE_SERVICE.service" 2>/dev/null | grep -q "$BRIDGE_SERVICE"; then
  if [ -x "$BRIDGE_VENV/bin/pip" ]; then
    "$BRIDGE_VENV/bin/pip" install -q -r "$REPO/ops/agent-bridge/requirements.txt"
  fi
  if ! cmp -s "$REPO/ops/agent-bridge/$BRIDGE_SERVICE.service" "$HOME/.config/systemd/user/$BRIDGE_SERVICE.service"; then
    echo "   ATENTIE: unit-ul din repo difera de cel instalat (~/.config/systemd/user/). Nu il suprascriu automat."
  fi
  systemctl --user restart "$BRIDGE_SERVICE"
  sleep 3
  echo "   serviciu: $(systemctl --user is-active "$BRIDGE_SERVICE" || true)"
  if [ -f "$BRIDGE_ENV" ]; then
    SECRET="$(grep -E '^BRIDGE_SHARED_SECRET=' "$BRIDGE_ENV" | cut -d= -f2- || true)"
    curl -s -o /dev/null -w "   /healthz -> %{http_code}\n" -H "X-Bridge-Secret: $SECRET" http://127.0.0.1:8765/healthz || echo "   /healthz -> nu raspunde"
    APP_SECRET="$(grep -E '^ASSISTANT_BRIDGE_SECRET=' .env | cut -d= -f2- || true)"
    [ -n "$SECRET" ] && [ "$SECRET" = "$APP_SECRET" ] \
      || echo "   ATENTIE: BRIDGE_SHARED_SECRET != ASSISTANT_BRIDGE_SECRET (deploy/.env) — asistentul nu va merge"
  else
    echo "   ATENTIE: lipseste $BRIDGE_ENV"
  fi
else
  echo "   $BRIDGE_SERVICE nu e instalat — Asistentul AI nu va merge. Vezi ops/agent-bridge/README.md"
fi

echo "==> stare containere"
$DC ps --format "table {{.Name}}\t{{.Status}}"

echo "==> health HTTP"
curl -s -o /dev/null -w "   http://localhost/api/health     -> %{http_code}\n" http://localhost/api/health || true
curl -s -o /dev/null -w "   https://$DOMAIN/api/health -> %{http_code}\n" "https://$DOMAIN/api/health" || true
curl -s -o /dev/null -w "   https://$DOMAIN/berlinstar/ -> %{http_code}\n" "https://$DOMAIN/berlinstar/" || true

echo
echo "Gata. App: https://$DOMAIN/berlinstar/"
