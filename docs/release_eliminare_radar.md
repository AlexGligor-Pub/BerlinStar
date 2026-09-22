# Release: eliminarea Radar AI

Radar AI a fost scos complet din BerlinStar.

## Ce s-a schimbat

| Zonă | Ce pleacă |
|---|---|
| Containere | `radar` și `radar-worker` (imaginea `deploy/radar.Dockerfile`, `deploy/radar-entrypoint.sh`) |
| Cod serviciu | tot directorul `services/radar/`, `scripts/dev-radar.sh` |
| Backend | proxy-ul `/api/radar/*` (inclusiv `/api/radar/discovery/*`), API-ul intern `/api/internal/*`, `/api/admin/ai-settings`, `/api/admin/ai-usage`, `/api/global-settings/features`, `RADAR_SERVICE_URL` / `RADAR_SHARED_SECRET` din `config.py` |
| Frontend | pagina `/radar` și intrarea „Radar AI” din meniu, `api/radar.ts`, `store/featuresStore.ts` |
| AdminV2 | grupul **Radar AI** (secțiunile „AI Radar” și „Consum AI”) |
| Bază de date | migrarea `radx01remove` (după `rad01radar`): șterge schema `radar` cu toate tabelele ei și coloanele `global_settings.radar_enabled`, `anthropic_api_key_enc`, `google_places_api_key_enc`, `ai_model`, `ai_price_in_usd_mtok`, `ai_price_out_usd_mtok` |
| Deploy | `deploy-prod.sh`, `deploy-qa.sh` și updater-ul rulează `docker compose up -d --build --remove-orphans`, ca să oprească și să șteargă containerele care nu mai sunt în compose |
| Documentație | `docs/radar_*.md`, secțiunea Radar din `deploy/README.md` |

Cheile Anthropic / Google Places salvate în AdminV2 erau folosite doar de Radar și
se șterg odată cu coloanele. Asistentul AI din AdminV2 (agent-bridge) nu e afectat.

## Upgrade în producție

Cu updater-ul automat, codul e deja tras și backup-ul bazei e deja făcut: se sare
direct la `docker compose build`. Manual, întâi codul și backup-ul — migrarea șterge
date:

```bash
cd ~/berlinstar && git checkout MainProd && git pull --ff-only
cd deploy
docker compose exec -T db pg_dump -U berlinstar berlinstar > backup_Productie_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_Productie_* | tail -1            # fișierul trebuie să aibă dimensiune > 0
```

Apoi:

```bash
cd ~/berlinstar/deploy
docker compose build --no-cache backend frontend
docker compose up -d --remove-orphans          # opreste si sterge radar + radar-worker
docker compose exec -T backend alembic current # radx01remove (head)
```

Curățenie (opțional, eliberează câteva sute de MB):

```bash
docker rmi deploy-radar:latest deploy-radar-worker:latest || true
```

În `deploy/.env` rămân cheile `RADAR_SHARED_SECRET`, `RADAR_DATABASE_URL`,
`MONOLITH_URL`, `RADAR_MAX_RUN_COST_USD`. Nu le mai citește nimeni și pot rămâne
acolo; nu e nevoie să fie șterse la update.

## Verificare

```bash
cd ~/berlinstar/deploy
docker compose ps -a --format "{{.Service}}  {{.Status}}"
# doar serviciile: db, backend, frontend, caddy, autoheal — toate Up (healthy unde au healthcheck)
curl -s -o /dev/null -w '%{http_code}\n' https://professorprime.ro/api/health           # 200
curl -s -o /dev/null -w '%{http_code}\n' https://professorprime.ro/api/radar/settings   # 404
docker compose exec -T db psql -U berlinstar -d berlinstar -Atc \
  "select count(*) from information_schema.schemata where schema_name='radar';"          # 0
```

În aplicație: meniul nu mai are „Radar AI”, iar AdminV2 nu mai are grupul Radar AI.

## Rollback

Codul vechi are nevoie de containerele radar și de datele lor, deci rollback-ul
înseamnă commit-ul anterior **plus** restaurarea backup-ului făcut înainte de update
(`docs/deploy_productie.md`, secțiunea 5). `alembic downgrade rad01radar` pune la loc
doar coloanele, goale: cheile AI și istoricul Radar se recuperează numai din backup.

## Dacă migrarea cade cu `lock timeout`

Înseamnă că un container radar vechi e încă pornit (de exemplu după un `up` fără
`--remove-orphans`). Se opresc containerele rămase și se repornește backend-ul:

```bash
cd ~/berlinstar/deploy
docker compose up -d --remove-orphans
docker compose restart backend
docker compose exec -T backend alembic current   # radx01remove (head)
```
