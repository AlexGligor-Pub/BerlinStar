# Server QA — BerlinStar

Mediu de **testare** care rulează stack-ul complet BerlinStar în Docker, separat de producție.
Acest fișier e referința de start pentru orice sesiune nouă (chat) care lucrează cu QA.

> Secretele (token GitHub, parole, chei S3) **NU** sunt în acest fișier. Sunt pe server
> (`~/.git-credentials`, `deploy/.env.qa`) și în memoria asistentului. Nu le comite în git.

---

## 1. Date de conectare

| | |
|---|---|
| Hostname | `berlinqa` |
| IP (LAN) | **192.168.1.136** (rezervat pe router prin DHCP) |
| User SSH | `berlinqa` |
| OS | Ubuntu 24.04, kernel 6.17 |
| Parolă consolă / sudo | `alexgligor` |

**Cheia SSH** e în repo la `QA_ENV/id_ed25519_siemens` (folder **gitignored** — nu intră în git).
Pe mount-ul Windows are permisiuni 777, iar SSH refuză cheia prea permisivă, deci se copiază întâi:

```bash
cp QA_ENV/id_ed25519_siemens /tmp/id_ed25519_siemens
chmod 600 /tmp/id_ed25519_siemens
ssh -i /tmp/id_ed25519_siemens berlinqa@192.168.1.136
```

---

## 2. Unde rulează aplicația (URL-uri)

Edge-ul e nginx (containerul `frontend`), publicat direct pe **portul 80** al serverului.

| URL | Ce e |
|---|---|
| `http://192.168.1.136/berlinstar/` | **Aplicația** (SPA SolidJS) |
| `http://192.168.1.136/` | Site de marketing static |
| `http://192.168.1.136/api/*` | API backend (FastAPI) |

Pentru acces din afara rețelei: **port forwarding TCP 80 → 192.168.1.136:80** (Remote IP gol = orice sursă).
**NU** expune portul 5432 (Postgres) în afară.

---

## 3. Stack Docker

Dir de deploy pe server: **`~/berlinstar`** (clonă git). Comenzile rulează din `~/berlinstar/deploy`.

Comandă de bază (override-ul QA e obligatoriu):
```bash
docker compose -f docker-compose.yml -f docker-compose.qa.yml <comanda>
```

Servicii:
| Container | Rol | Port host |
|---|---|---|
| `deploy-frontend-1` | nginx: SPA + marketing + proxy `/api` | 80 |
| `deploy-backend-1` | FastAPI / gunicorn | — (intern) |
| `deploy-db-1` | Postgres 16 | 5432 (doar LAN) |
| `berlinstar_autoheal` | restart automat la `unhealthy` | — |

`restart: unless-stopped` + Docker enabled la boot → stack-ul revine după reboot.
Caddy din `docker-compose.yml` e dezactivat pe QA (profile `edge`); pe QA nu folosim TLS/domeniu.

### Config QA (diferă de producție)
- `deploy/.env.qa` → copiat în `deploy/.env` la fiecare deploy. **Conține secrete, gitignored.**
  - `VITE_BASE_PATH=/berlinstar/`, `CORS_ORIGINS=http://192.168.1.136`
  - `PUBLIC_BASE_URL=http://192.168.1.136/berlinstar`
- `deploy/docker-compose.qa.yml` → frontend pe port 80, Caddy off, db expune 5432. (tracked în git)

---

## 4. Baza de date

- Postgres 16, baza **`berlinstar`**, user `berlinstar` (parolă în `.env.qa`).
- Restaurată din `deploy/backup_Productie_20260528_190213.sqlplus` (dump prod).
- Migrațiile Alembic rulează automat la pornirea backend-ului (`entrypoint.sh` → `alembic upgrade head`).

Restore manual al unui dump (plain SQL pg_dump):
```bash
cd ~/berlinstar/deploy
DC="docker compose -f docker-compose.yml -f docker-compose.qa.yml"
cat backup_XXXX.sqlplus | $DC exec -T db psql -U berlinstar -d berlinstar
```

Acces psql ad-hoc:
```bash
docker compose -f docker-compose.yml -f docker-compose.qa.yml exec db psql -U berlinstar -d berlinstar
```

---

## 5. Git pe server

- Clonă completă în `~/berlinstar`, branch **`Main6Iun`** (branch-ul de lucru curent).
- Remote `origin` = `https://github.com/AlexGligor-Pub/BerlinStar.git`, creds (PAT) în `~/.git-credentials` → `git pull`/`push` merg.
- **`core.autocrlf=input`** și fișiere **LF**. Sursa de pe Windows e CRLF; pe Linux trebuie LF,
  altfel `deploy/entrypoint.sh` cu `#!/bin/sh\r` **blochează pornirea containerului backend**.
  Dacă re-transferi fișiere de pe Windows, asigură-te că rămân LF.

---

## 6. Cum lucrăm / cum facem deploy

**Flux normal:** editezi local → commit → push pe `Main6Iun` → rulezi scriptul de deploy pe QA.

1. Local (pe calculatorul de dezvoltare):
   ```bash
   git add -A && git commit -m "..."
   git push origin Main6Iun
   ```
   > `git push` are nevoie de PAT-ul GitHub (e în memoria asistentului). NU pune secrete în commit
   > (vezi `.gitignore`: `QA_ENV/`, `deploy/.env.qa` sunt excluse).

2. Pe QA — un singur script face tot (pull + rebuild + restart + verificare):
   ```bash
   ssh -i /tmp/id_ed25519_siemens berlinqa@192.168.1.136 '~/berlinstar/deploy-qa.sh'
   ```
   Scriptul `~/berlinstar/deploy-qa.sh` face: `git pull --ff-only origin Main6Iun`,
   `cp .env.qa .env`, `docker compose ... up -d --build`, așteaptă `healthy`, afișează status + health.

**Deploy manual** (echivalent), din `~/berlinstar/deploy`:
```bash
git -C ~/berlinstar pull --ff-only origin Main6Iun
cp .env.qa .env
docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d --build
```

> Rebuild-ul e necesar doar dacă imaginea nu conține deja codul nou. Modificările de frontend/backend
> intră în imagine la `--build`.

---

## 7. Claude Code pe QA (AI pe server)

Claude Code e instalat pe server (binar nativ, fără Node) la `~/.local/bin/claude`.
Cheia API (`ANTHROPIC_API_KEY`) e configurată în `~/.bashrc`, deci într-o sesiune SSH
interactivă se încarcă automat.

Folosire — pornește AI direct în folderul proiectului:
```bash
ssh -i /tmp/id_ed25519_siemens berlinqa@192.168.1.136
cd ~/berlinstar
claude
```

- Pornit din `~/berlinstar`, Claude lucrează cu tot proiectul (cod, git, docker, `deploy-qa.sh`).
- Sesiune interactivă → cheia se încarcă singură din `~/.bashrc`.
- Pentru rulări **non-interactive** (`ssh host 'claude -p ...'`) `.bashrc` nu se sourceaza;
  exportă cheia explicit în acel context.
- One-shot: `claude -p "task"`. Config: `~/.claude/`.
- ⚠️ Cheia API e în plaintext pe server — relevant dacă serverul devine accesibil din afară.

---

## 8. Operații uzuale & debugging

```bash
cd ~/berlinstar/deploy
DC="docker compose -f docker-compose.yml -f docker-compose.qa.yml"

$DC ps                          # stare containere
$DC logs -f backend             # loguri backend (inclusiv migrații Alembic)
$DC logs -f frontend            # loguri nginx
$DC restart backend             # restart un serviciu
$DC down                        # opreste stack-ul (pastreaza datele)
$DC up -d                       # porneste

curl -s http://localhost/api/health      # -> {"status":"ok","db":"ok"}
```

---

## 9. De reținut (capcane)

- **CRLF/LF**: fișierele trebuie LF pe server (mai ales `entrypoint.sh`). `core.autocrlf=input` e setat.
- **Secrete**: nu comite `QA_ENV/`, `deploy/.env.qa`. Sunt gitignored.
- **Port forwarding**: doar 80 → 80; nu expune 5432.
- **IP**: 192.168.1.136 e rezervat pe router (nu se schimbă).
- **PAT GitHub în plaintext** pe server (`~/.git-credentials`, chmod 600) — alternativă mai sigură = deploy key SSH.
- **Branch `Main6Iun`** e branch-ul de lucru (există pe GitHub și pe QA). `master` pe GitHub e vechi.
- QA ≠ producție: vezi `deploy/README.md` și docs pentru producție.
