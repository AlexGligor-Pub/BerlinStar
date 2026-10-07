# Deploy în producție — BerlinStar

Ghid pas cu pas pentru serverul de **producție** (`professorprime.ro`, 46.224.120.225).
Serverul de QA e o altă mașină (`berlinqa`, rețea locală) — comenzile de mai jos
se rulează **pe prod**, prin SSH.

- Branch de producție: `MainProd`
- Repo pe server: `~/berlinstar`
- Compose: `deploy/docker-compose.yml` (fără `docker-compose.qa.yml`)
- Script de deploy: `~/berlinstar/deploy-prod.sh`

---

## 1. Înainte de deploy

```bash
ssh <user>@46.224.120.225
cd ~/berlinstar

# a) sesiune tmux — dacă pică SSH-ul, deploy-ul continuă
tmux new -s deploy          # reatașare ulterioară: tmux attach -t deploy

# b) backup bază de date
cd deploy
docker compose exec -T db pg_dump -U berlinstar berlinstar > backup_Productie_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_Productie_* | tail -1     # fișierul trebuie să aibă dimensiune > 0
cd ..

# c) ce se va deploya
git fetch origin
git log --oneline HEAD..origin/MainProd
```

### Verificare `deploy/.env`

`deploy/.env` **nu e în git** și nu e suprascris de script. Trebuie să conțină
(valorile nu se pun niciodată în repo):

| Variabilă | Observații |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | |
| `DATABASE_URL` | `postgresql+asyncpg://<user>:<parola>@db:5432/<db>` |
| `SECRET_KEY` | |
| `CORS_ORIGINS` | `https://professorprime.ro` |
| `S3_*` | Hetzner Object Storage |
| `ASSISTANT_BRIDGE_URL`, `ASSISTANT_BRIDGE_SECRET` | adăugate automat de script la prima instalare a agent-bridge |

Verificare rapidă (afișează doar ce lipsește, nu valorile):

```bash
cd ~/berlinstar/deploy
for v in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL SECRET_KEY CORS_ORIGINS; do
  grep -qE "^${v}=.+" .env || echo "LIPSESTE: $v"
done
```

---

## 2. Deploy

```bash
cd ~/berlinstar
./deploy-prod.sh                    # deploy normal
./deploy-prod.sh --install-agent    # + reinstalare agent-bridge (venv, unit systemd, env)
```

Scriptul face, în ordine:
1. verifică existența `deploy/.env`;
2. `git checkout MainProd` + `git pull --ff-only`;
3. instalează agent-bridge dacă lipsește (sau cu `--install-agent`);
4. `docker compose -f docker-compose.yml up -d --build --remove-orphans`;
5. așteaptă backend `healthy` (max. 2 min);
6. repornește `berlinstar-agent-bridge` (systemd `--user`) și verifică `/healthz`;
7. afișează starea containerelor și health-urile HTTP.

**Nu întrerupe scriptul** (Ctrl+C, închiderea terminalului) în timpul pasului 4:
containerele vechi sunt deja oprite, iar cele noi rămân în starea `Created` →
site-ul e căzut. Vezi secțiunea 4.

---

## 3. Verificare după deploy

```bash
cd ~/berlinstar/deploy
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

Toate trebuie să fie `Up` și `(healthy)`: `db`, `backend`, `frontend`,
`berlinstar_caddy`, `berlinstar_autoheal`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://professorprime.ro/api/health     # 200
curl -s -o /dev/null -w '%{http_code}\n' https://professorprime.ro/berlinstar/    # 200
docker compose logs --tail 50 backend
systemctl --user is-active berlinstar-agent-bridge                               # active
```

Apoi un test manual în aplicație: login, deschidere o fișă, AdminV2.

---

## 4. Probleme frecvente

### Deploy întrerupt — containere în `Created` / `Exited (137)`

Simptom: `docker ps -a` arată containere `Created` (unele cu prefix hash, ex.
`257d4f8bf741_deploy-backend-1`) și site-ul nu răspunde.

```bash
cd ~/berlinstar/deploy
docker volume ls | grep postgres_data        # volumul bazei trebuie să existe
docker compose -f docker-compose.yml up -d   # pornește stack-ul cu imaginile deja construite
```

Dacă build-ul nu apucase să termine, rulează din nou `./deploy-prod.sh` (în tmux).

### Backend `unhealthy`

```bash
docker compose logs --tail 200 backend
docker compose exec backend alembic current
```

### Asistentul AI nu merge

```bash
systemctl --user status berlinstar-agent-bridge
journalctl --user -u berlinstar-agent-bridge -n 50
```

`BRIDGE_SHARED_SECRET` din `~/.config/berlinstar-agent-bridge.env` trebuie să fie
identic cu `ASSISTANT_BRIDGE_SECRET` din `deploy/.env`. Portul 8765 nu trebuie
să fie accesibil din internet.

---

## 5. Rollback

```bash
cd ~/berlinstar
git log --oneline -10 MainProd                 # alege commit-ul bun
git checkout <commit>                          # detached HEAD, temporar
cd deploy && docker compose -f docker-compose.yml up -d --build
```

Dacă a fost o migrare de schemă care a stricat datele, restore din backup-ul de
la pasul 1:

```bash
cd ~/berlinstar/deploy
docker compose stop backend
cat backup_Productie_<data>.sql | docker compose exec -T db psql -U berlinstar berlinstar
docker compose start backend
```

După fix, revino pe branch: `git checkout MainProd`.

---

## 6. Botul de loguri pe Telegram (@BerlinStarProd_bot)

Cod: `~/berlinstar/telegram-claude-bot`. Pe prod rulează ca serviciu systemd
de sistem (`/etc/systemd/system/berlinstar-logbot.service`).

```bash
# ce variantă e instalată
systemctl list-unit-files | grep logbot          # serviciu de sistem
systemctl --user list-unit-files | grep logbot   # serviciu de user

# serviciu de sistem
sudo systemctl enable --now berlinstar-logbot
sudo systemctl restart berlinstar-logbot         # după modificări în cod / .env
sudo systemctl status berlinstar-logbot
sudo journalctl -u berlinstar-logbot -f

# serviciu de user
systemctl --user enable --now berlinstar-logbot
journalctl --user -u berlinstar-logbot -f
```

Prima instalare / debug manual:

```bash
cd ~/berlinstar/telegram-claude-bot
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
# .env: TELEGRAM_BOT_TOKEN (tokenul @BerlinStarProd_bot), USE_API_KEY=0, ALLOWED_USER_IDS, REPORT_HOURS, REPORT_TZ
claude            # apoi /login, o singură dată, ca userul care rulează serviciul
./.venv/bin/python bot.py
```

- Un token de bot poate fi folosit de **un singur server**. QA are alt bot;
  dacă același token rulează în două locuri → `409 Conflict`.
- În Telegram trimite `/start` ca să primești rapoartele automate.

---

## 7. Checklist scurt

- [ ] `tmux new -s deploy`
- [ ] backup DB (`pg_dump`), fișier > 0
- [ ] variabile obligatorii prezente în `deploy/.env`
- [ ] `./deploy-prod.sh`
- [ ] toate containerele `healthy`, `/api/health` → 200
- [ ] test manual în aplicație
- [ ] `berlinstar-agent-bridge` și `berlinstar-logbot` active
