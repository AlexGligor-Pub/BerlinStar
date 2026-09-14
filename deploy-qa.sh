#!/usr/bin/env bash
# Deploy QA BerlinStar: git pull (Main6Iun) + rebuild + restart + verificare.
# Ruleaza pe serverul QA:  ~/berlinstar/deploy-qa.sh
set -euo pipefail

REPO="$HOME/berlinstar"
BRANCH="Main9Iun"
DC="docker compose -f docker-compose.yml -f docker-compose.qa.yml"

cd "$REPO"

echo "==> git pull ($BRANCH)"
git fetch origin
git pull --ff-only origin "$BRANCH"

cd "$REPO/deploy"
cp .env.qa .env

echo "==> rebuild + restart"
$DC up -d --build

echo "==> astept backend healthy"
for i in $(seq 1 45); do
  st="$($DC ps backend --format '{{.Health}}' 2>/dev/null || true)"
  [ "$st" = "healthy" ] && { echo "   backend: healthy"; break; }
  [ "$st" = "unhealthy" ] && { echo "   backend: UNHEALTHY — verifica logurile: $DC logs backend"; break; }
  sleep 2
done

echo "==> stare containere"
$DC ps --format "table {{.Name}}\t{{.Status}}"

echo "==> health HTTP"
curl -s -o /dev/null -w "   /api/health  -> %{http_code}\n" http://localhost/api/health || true
curl -s -o /dev/null -w "   /berlinstar/ -> %{http_code}\n" http://localhost/berlinstar/ || true

echo
echo "Gata. App: http://192.168.1.136/berlinstar/"
