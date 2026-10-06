# Deploy pe producție: backup, rollback și ce ai de făcut înainte de următorul push

Document pentru proprietar. Descrie ce face auto-updater-ul
(`telegram-claude-bot/updater.py`) începând cu această versiune și pașii manuali
care **nu pot fi făcuți din cod**.

> **Atenție la primul push.** Deploy-ul care aduce această versiune este rulat încă de
> updater-ul **vechi** (procesul botului are codul vechi în memorie și se repornește abia
> la final). Deci la acest deploy se mai comite și se mai urcă pe GitHub **un dump**, iar
> un rollback automat ar face încă rebuild din sursă. De aceea pașii din secțiunea 2 se
> fac **înainte** de push.

---

## 1. Ce face updater-ul acum

| Pas | Înainte | Acum |
|---|---|---|
| Dump DB | `deploy/backup_Productie_<ts>.sqlplus` + `/root/db_backups/auto_update_<ts>.dump` | la fel, neschimbat |
| Publicare dump | `git add .` + commit + push pe GitHub | **eliminat** — dump-urile rămân doar pe server |
| Retenție | ultimele 10 `.dump` | ultimele 10 `.dump` + ultimele 10 `.sqlplus` **neurmărite de git** (cele 21 deja urmărite nu sunt atinse) |
| Imagini | nimic | imaginile care rulează primesc tag-ul `berlinstar-backend:rollback` și `berlinstar-frontend:rollback` |
| Rollback containere | mereu `build --no-cache` din codul vechi | repune imaginile `:rollback` + `up -d --no-build`; rebuild doar dacă imaginile lipsesc |
| Rollback DB | un `pg_restore` eșuat apărea ca „cu avertismente”, sub titlul „Rollback terminat” | `pg_restore` cu cod de ieșire ≠ 0 ⇒ titlul devine „Rollback cu probleme” |
| Mesaj de succes | doar verificările | în plus, avertisment dacă backend/frontend rulează **aceeași imagine** ca înainte de update |

Numărul de fișiere păstrate se schimbă cu `UPDATE_KEEP_DUMPS` în `.env`-ul botului.
`GIT_PUSH_TOKEN` nu mai e folosit la push (rămâne doar ascuns din loguri); poate fi scos
din `.env`-ul botului. Tokenul din `~/.git-credentials` e în continuare necesar pentru
`git fetch`.

**Consecință importantă:** git era singura copie a backup-urilor în afara serverului.
Acum **nu mai există nicio copie off-site** făcută automat. Vezi secțiunea 5.

---

## 2. Obligatoriu înainte de următorul push pe `MainProd`

1. **Fă depozitul GitHub privat.** În `deploy/` sunt urmărite 21 de dump-uri de producție
   (`backup_Productie_*.sql` și `*.sqlplus`), iar updater-ul vechi mai urcă unul la acest
   deploy. După ce îl faci privat, verifică pe server că tokenul mai are acces:
   `git -C <repo> fetch origin MainProd` (altfel updater-ul anunță „git fetch a eșuat”
   și nu face nimic).
2. **Marchează imaginile care rulează** (updater-ul vechi nu o face):
   ```bash
   cd <repo>/deploy
   for s in backend frontend; do
     c=$(docker compose ps -q $s)
     docker inspect -f "$s: {{.Config.Image}}" $c        # notează numele (ex. deploy-backend)
     docker image tag "$(docker inspect -f '{{.Image}}' $c)" berlinstar-$s:manual-$(date +%Y%m%d)
   done
   ```
3. **Fă un dump manual** în afara depozitului:
   ```bash
   mkdir -p /root/db_backups
   docker compose exec -T db pg_dump -Fc -U berlinstar berlinstar \
     > /root/db_backups/manual_$(date +%Y%m%d_%H%M%S).dump
   ls -lh /root/db_backups | tail -2                    # dimensiune > 0
   ```
   Copiază-l și în afara serverului (laptop / bucket privat).
4. **Fii pe Telegram în timpul deploy-ului.** Dacă updater-ul raportează probleme,
   răspunde cu un sfat; **nu** trimite `/rollback` și nu lăsa să treacă cele 60 de minute:
   rollback-ul updater-ului vechi reconstruiește codul vechi cu dependențe nefixate și
   backend-ul poate să nu mai pornească. Dacă e nevoie, fă rollback de mână (secțiunea 4).
5. **După deploy:** verifică mesajul „Codul botului s-a schimbat — repornesc botul”
   (de aici încolo rulează updater-ul nou) și că containerele au fost într-adevăr
   înlocuite: `docker inspect -f '{{.Created}}' $(docker compose ps -q backend)` trebuie
   să fie după ora deploy-ului.

---

## 3. Secrete de rotit (după ce depozitul e privat)

Rotirea înainte de închiderea expunerii e inutilă: următorul dump le-ar publica din nou.

Expuse de vechiul `deploy/.env.example` și de `QA.md`:
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` (Hetzner Object Storage) — verifică în consola
  Hetzner dacă perechea mai există; dacă da, creează alta, pune-o în `deploy/.env`
  (producție și QA), repornește backend-ul, apoi șterge-o pe cea veche;
- parola de consolă / sudo a userului `berlinqa` de pe serverul QA.

Expuse de dump-urile din `deploy/`:
- `global_settings.smtp_password` (parola SMTP);
- `efactura_global_settings.fernet_key` — cu ea se pot decripta celelalte două de mai jos;
  schimbarea ei cere re-criptarea valorilor stocate;
- secretul clientului OAuth ANAF (`efactura_global_settings.oauth_client_secret_enc`);
- tokenurile ANAF de acces și refresh (`anaf_tokens`) ale firmelor conectate —
  revocă și reautorizează fiecare firmă;
- parolele din `users.password` și `accounts.password`: câteva sunt în clar (schimbă-le
  imediat), restul sunt hash-uri bcrypt (recomandat: resetare pentru toți);
- sesiunile active (`user_sessions`) — revocă-le pe toate;
- datele clienților și ale angajaților nu pot fi „rotite”: evaluează obligația de
  notificare GDPR.

De verificat separat: parola de bază de date din `docs/db_restore_20260515.md` (rândul cu
`DATABASE_URL`), dacă mai e folosită undeva.

**Mai târziu, după ce updater-ul nou rulează** (nu înainte — updater-ul vechi anulează
deploy-ul dacă nu are ce comite):
1. adaugă `*.sqlplus` și `deploy/backup_*` în `.gitignore` și rulează
   `git rm --cached deploy/backup_Productie_*`. La pull, fișierele acestea dispar din
   directorul de lucru de pe server — copiază înainte ce vrei să păstrezi;
2. șterge dump-urile din istoric (`git filter-repo --path-glob 'deploy/backup_Productie_*'
   --invert-paths`), force-push, apoi clonează din nou depozitul pe servere.

---

## 4. Rollback de mână

1. **Oprește auto-update-ul**, altfel la următoarea verificare (15 min) reinstalează
   versiunea nouă: `systemctl stop berlinstar-logbot` (sau `UPDATE_CHECK_MINUTES=0` în
   `.env`-ul botului + restart).
2. Codul: `git -C <repo> reset --hard <sha-vechi>`.
3. Imaginile — fără rebuild. `<nume>` e numele notat la pasul 2.2 (sau
   `docker compose config --images`); `<tag>` e `rollback` (pus de updater-ul nou la
   ultimul update) sau `manual-<data>`:
   ```bash
   cd <repo>/deploy
   docker image tag berlinstar-backend:<tag>  <nume-backend>
   docker image tag berlinstar-frontend:<tag> <nume-frontend>
   docker compose up -d --no-build --remove-orphans
   docker compose ps
   ```
   Tag-ul `:rollback` e mutat la fiecare update: arată mereu spre imaginile de dinaintea
   **ultimului** update.
4. `deploy/.env`: dacă a fost schimbat, copia e în `deploy/.env.bak_autoupdate_<ts>`.
5. Baza de date — **numai dacă update-ul a rulat o migrare** (revizia alembic s-a
   schimbat). Restore-ul aruncă tot ce s-a scris după dump (bonuri, plăți, stoc, numere de
   factură), în timp ce facturile deja trimise la ANAF rămân trimise:
   ```bash
   docker compose stop backend
   docker compose exec -T db psql -U berlinstar -d postgres -c \
     'ALTER DATABASE berlinstar RENAME TO berlinstar_failed_manual'
   docker compose exec -T db psql -U berlinstar -d postgres -c \
     'CREATE DATABASE berlinstar OWNER berlinstar'
   docker compose exec -T db pg_restore -U berlinstar -d berlinstar --no-owner \
     --role=berlinstar < /root/db_backups/<fisier>.dump
   docker compose up -d --no-build
   ```
   Pornește backend-ul doar dacă `pg_restore` s-a terminat fără erori: pe o bază goală
   backend-ul creează singur o schemă nouă, fără date. Baza veche rămâne ca
   `berlinstar_failed_manual`.
6. Repornește botul și scoate versiunea stricată de pe `MainProd` (sau lasă botul oprit
   până apare un commit corectat).

---

## 5. Ce NU s-a schimbat (intenționat) și ce rămâne de făcut

- **Backup off-site.** Nu am adăugat urcarea dump-urilor în alt loc. Propunere: un cron
  zilnic, independent de deploy, care urcă dump-ul `-Fc` într-un bucket **privat**, cu
  retenție.
- **Build-ul și `up` sunt făcute tot de agentul LLM**, pe baza promptului. Updater-ul nu
  poate garanta că rulează codul nou: `/api/health` și imaginile nu expun SHA-ul din care
  au fost construite. Avertismentul „aceeași imagine” e doar un semnal, nu oprește
  deploy-ul. Propunere: `ARG GIT_SHA` în cele două Dockerfile-uri (ca `LABEL` și
  variabilă de mediu), transmis din `docker-compose.yml`, întors de `/api/health` ca
  `version`, iar `verify()` să ceară egalitatea cu `git rev-parse HEAD`.
- **Regula „nu șterge imaginile `:rollback`”** e doar text în promptul agentului, nu o
  interdicție tehnică.
- **Scrierile dintre dump și rollback.** Când un update cu migrare eșuează, aplicația
  rămâne pornită cât se așteaptă sfatul; un rollback pierde acele scrieri. Logica de
  restore e neschimbată (în afară de raportarea eșecului). Propunere: la eșec cu revizie
  alembic schimbată, oprește backend-ul înainte de așteptare; după un `pg_restore` eșuat,
  nu porni backend-ul; pe termen lung, migrări compatibile înapoi.
- **`.gitignore` și cele 21 de dump-uri urmărite** nu au fost atinse (vezi ordinea din
  secțiunea 3).
- **Contextul de build Docker** este rădăcina depozitului și nu există `.dockerignore`,
  deci dump-urile din `deploy/` sunt trimise la fiecare build. Propunere: `.dockerignore`
  cu `deploy/backup_*`.
