#!/usr/bin/env bash
# Deploy PRODUCTIE BerlinStar: git pull (MainProd) + instalare agent-bridge (daca lipseste)
# + rebuild + restart + verificare.
#
# Ruleaza pe serverul de productie:
#   ~/berlinstar/deploy-prod.sh                  # deploy normal (instaleaza agentul doar daca lipseste)
#   ~/berlinstar/deploy-prod.sh --install-agent  # forteaza re-instalarea agentului (venv, unit, env)
#
# Diferente fata de deploy-qa.sh:
#   - NU foloseste docker-compose.qa.yml (Caddy + TLS pornesc, DB nu e expus)
#   - NU suprascrie .env (foloseste deploy/.env de productie, care trebuie sa existe)
#   - instaleaza / reporneste agent-bridge (systemd --user)
set -euo pipefail

REPO="${REPO:-$HOME/berlinstar}"
BRANCH="${BRANCH:-MainProd}"
DOMAIN="professorprime.ro"
DC="docker compose -f docker-compose.yml"

BRIDGE_SERVICE="berlinstar-agent-bridge"
BRIDGE_ENV="$HOME/.config/berlinstar-agent-bridge.env"
BRIDGE_VENV="$HOME/agent-bridge-venv"
BRIDGE_UNIT="$HOME/.config/systemd/user/$BRIDGE_SERVICE.service"
BRIDGE_PORT=8765

FORCE_INSTALL=0
[ "${1:-}" = "--install-agent" ] && FORCE_INSTALL=1

env_get() { grep -E "^$1=" "$2" 2>/dev/null | tail -n1 | cut -d= -f2- || true; }

install_bridge() {
  echo "==> instalare agent-bridge"

  # 1. claude CLI (agentul ruleaza Claude Code pe host)
  if ! command -v claude >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/claude" ]; then
    echo "   instalez claude CLI in ~/.local/bin"
    curl -fsSL https://claude.ai/install.sh | bash
  fi
  echo "   claude: $("$HOME/.local/bin/claude" --version 2>/dev/null || claude --version 2>/dev/null || echo 'NEGASIT')"

  # 2. venv + dependente
  if [ ! -x "$BRIDGE_VENV/bin/pip" ]; then
    echo "   creez venv $BRIDGE_VENV"
    python3 -m venv "$BRIDGE_VENV" || { echo "   EROARE: lipseste python3-venv (sudo apt install python3-venv)"; exit 1; }
    "$BRIDGE_VENV/bin/pip" install -q -U pip
  fi
  "$BRIDGE_VENV/bin/pip" install -q -r "$REPO/ops/agent-bridge/requirements.txt"

  # 3. fisier de mediu cu secrete (generat o singura data)
  mkdir -p "$(dirname "$BRIDGE_ENV")"
  if [ ! -f "$BRIDGE_ENV" ]; then
    echo "   creez $BRIDGE_ENV (secret generat automat)"
    sed -e "s|^BRIDGE_SHARED_SECRET=.*|BRIDGE_SHARED_SECRET=$(openssl rand -hex 32)|" \
        -e "s|^BERLINSTAR_DIR=.*|BERLINSTAR_DIR=$REPO|" \
        -e "s|^ANTHROPIC_API_KEY=.*|# ANTHROPIC_API_KEY=  # optional; fara ea se foloseste abonamentul (claude login)|" \
        "$REPO/ops/agent-bridge/env.example" > "$BRIDGE_ENV"
  fi
  chmod 600 "$BRIDGE_ENV"

  # 4. secretul trebuie sa fie identic in deploy/.env (backend)
  local secret app_secret
  secret="$(env_get BRIDGE_SHARED_SECRET "$BRIDGE_ENV")"
  app_secret="$(env_get ASSISTANT_BRIDGE_SECRET "$REPO/deploy/.env")"
  if [ -z "$app_secret" ]; then
    echo "   adaug ASSISTANT_BRIDGE_URL / ASSISTANT_BRIDGE_SECRET in deploy/.env"
    cp "$REPO/deploy/.env" "$REPO/deploy/.env.bak_$(date +%Y%m%d_%H%M%S)"
    {
      echo ""
      echo "# Asistent AI — trebuie sa fie identic cu BRIDGE_SHARED_SECRET din $BRIDGE_ENV"
      grep -qE '^ASSISTANT_BRIDGE_URL=' "$REPO/deploy/.env" || echo "ASSISTANT_BRIDGE_URL=http://host.docker.internal:$BRIDGE_PORT"
      echo "ASSISTANT_BRIDGE_SECRET=$secret"
    } >> "$REPO/deploy/.env"
  elif [ "$app_secret" != "$secret" ]; then
    echo "   ATENTIE: ASSISTANT_BRIDGE_SECRET din deploy/.env difera de BRIDGE_SHARED_SECRET — nu le modific, aliniaza-le manual"
  fi

  # 5. unit systemd --user + pornire la boot
  mkdir -p "$(dirname "$BRIDGE_UNIT")"
  cp "$REPO/ops/agent-bridge/$BRIDGE_SERVICE.service" "$BRIDGE_UNIT"
  [ "$REPO" = "$HOME/berlinstar" ] || echo "   ATENTIE: unit-ul presupune repo in ~/berlinstar, dar REPO=$REPO — editeaza $BRIDGE_UNIT"
  loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" \
    || echo "   ATENTIE: nu am putut activa linger — agentul nu va porni la boot fara login"
  systemctl --user daemon-reload
  systemctl --user enable --now "$BRIDGE_SERVICE"

  # 6. firewall: bridge-ul asculta pe 0.0.0.0 si permite executie de cod pe host
  local iface
  iface="$(ip route show default 2>/dev/null | awk '{print $5; exit}')"
  if command -v ufw >/dev/null 2>&1 && sudo -n ufw status 2>/dev/null | grep -q "Status: active"; then
    sudo -n ufw deny in on "$iface" to any port "$BRIDGE_PORT" >/dev/null && echo "   ufw: portul $BRIDGE_PORT blocat pe $iface"
  else
    echo "   ATENTIE: nu am putut confirma un firewall activ. Portul $BRIDGE_PORT NU trebuie sa fie accesibil din internet:"
    echo "            sudo ufw deny in on ${iface:-<interfata-publica>} to any port $BRIDGE_PORT   (+ sudo ufw enable, cu grija la SSH)"
  fi

  # 7. autentificare Claude
  if [ -z "$(env_get ANTHROPIC_API_KEY "$BRIDGE_ENV")" ] && [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo "   ATENTIE: claude nu e autentificat. Ruleaza o data:  claude   (apoi /login), dupa care:"
    echo "            systemctl --user restart $BRIDGE_SERVICE"
  fi
}

cd "$REPO"

echo "==> verificari preliminare"
[ -f deploy/.env ] || { echo "   LIPSESTE deploy/.env — creeaza-l din deploy/.env.example"; exit 1; }
for v in POSTGRES_PASSWORD SECRET_KEY; do
  grep -qE "^${v}=.+" deploy/.env || echo "   ATENTIE: $v lipseste sau e gol in deploy/.env"
done

echo "==> git pull ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "   commit: $(git log -1 --oneline)"

# Instalarea agentului se face inainte de rebuild, ca backend-ul sa porneasca
# deja cu ASSISTANT_BRIDGE_SECRET in .env.
if [ "$FORCE_INSTALL" = 1 ] || [ ! -f "$BRIDGE_UNIT" ]; then
  install_bridge
fi

cd "$REPO/deploy"

echo "==> rebuild + restart containere"
$DC up -d --build --remove-orphans

echo "==> astept backend healthy"
for i in $(seq 1 60); do
  st="$($DC ps backend --format '{{.Health}}' 2>/dev/null || true)"
  [ "$st" = "healthy" ] && { echo "   backend: healthy"; break; }
  [ "$st" = "unhealthy" ] && { echo "   backend: UNHEALTHY — verifica logurile: cd deploy && $DC logs backend"; break; }
  [ "$i" = 60 ] && echo "   backend: inca nu e healthy dupa 2 min (stare: ${st:-necunoscuta})"
  sleep 2
done

echo "==> agent-bridge"
"$BRIDGE_VENV/bin/pip" install -q -r "$REPO/ops/agent-bridge/requirements.txt"
cmp -s "$REPO/ops/agent-bridge/$BRIDGE_SERVICE.service" "$BRIDGE_UNIT" \
  || echo "   ATENTIE: unit-ul din repo difera de cel instalat — ruleaza cu --install-agent ca sa-l actualizezi"
systemctl --user restart "$BRIDGE_SERVICE"
sleep 3
echo "   serviciu: $(systemctl --user is-active "$BRIDGE_SERVICE" || true)"
SECRET="$(env_get BRIDGE_SHARED_SECRET "$BRIDGE_ENV")"
curl -s -o /dev/null -w "   /healthz -> %{http_code}\n" -H "X-Bridge-Secret: $SECRET" "http://127.0.0.1:$BRIDGE_PORT/healthz" \
  || echo "   /healthz -> nu raspunde (journalctl --user -u $BRIDGE_SERVICE -n 50)"
[ -n "$SECRET" ] && [ "$SECRET" = "$(env_get ASSISTANT_BRIDGE_SECRET .env)" ] \
  || echo "   ATENTIE: BRIDGE_SHARED_SECRET != ASSISTANT_BRIDGE_SECRET (deploy/.env) — asistentul nu va merge"

echo "==> stare containere"
$DC ps --format "table {{.Name}}\t{{.Status}}"

echo "==> health HTTP"
curl -s -o /dev/null -w "   http://localhost/api/health     -> %{http_code}\n" http://localhost/api/health || true
curl -s -o /dev/null -w "   https://$DOMAIN/api/health -> %{http_code}\n" "https://$DOMAIN/api/health" || true
curl -s -o /dev/null -w "   https://$DOMAIN/berlinstar/ -> %{http_code}\n" "https://$DOMAIN/berlinstar/" || true

echo
echo "Gata. App: https://$DOMAIN/berlinstar/"
