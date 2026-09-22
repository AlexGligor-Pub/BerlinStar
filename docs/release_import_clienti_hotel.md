# Release: import clienți și hotel, Hotel anvelope nou, comutator Radar AI

Branch: `feat/import-clienti` → de adus în `MainProd` înainte de deploy.
Commit principal: `bf3c370`. Testat pe QA (192.168.1.141), 21–22 septembrie 2026.

Pentru procedura generală de deploy (tmux, `.env`, `deploy-prod.sh`, probleme
frecvente) vezi `docs/deploy_productie.md`. Aici e doar ce e specific acestui release.

---

## 1. Ce s-a schimbat

### Pentru utilizatori

**Configurări › Import (secțiune nouă)**
- **Import clienți** din CSV — doar administratorul contului. Formatul e descris în
  pagină. `tip` e opțional (implicit persoană fizică), iar telefoanele multiple se
  separă prin virgulă. Rândurile cu probleme (date lipsă, duplicate) intră într-o
  listă de rezolvat: le completezi și imporți, sau le respingi.
- **Import hotel anvelope** din Excel (.xlsx) sau CSV — administrator și manager.
  - Liniile se grupează în cazări, iar clientul se potrivește întâi după numărul de
    mașină, apoi după nume. Clienții care lipsesc se propun spre creare.
  - Locurile din depozit, dimensiunile, profilurile și DOT-urile care lipsesc se
    adaugă automat. Mărcile noi se propun spre aprobare în AdminV2.
  - Cazările intră pe un **punct de lucru**: cel al stației de la care faci importul.
    Dacă firma are mai multe, îl alegi înainte de import.
- Pentru ambele importuri:
  - **Istoricul sesiunilor**, cu procesare în fundal și bară de progres; un dublu
    click nu pornește importul de două ori.
  - **Raport CSV** cu ce s-a importat și ce nu.
  - **Anulare (revert)**: șterge ce a creat importul, dar păstrează ce s-a folosit
    între timp (de ex. o anvelopă editată, un client cu devize).

**Hotel anvelope**
- Lista e un tabel cu antet fix: nr., număr de mașină (mare), nume, telefon,
  dată, loc, rezumatul anvelopelor („4 anvelope · 4 iarnă”) și stare. Acțiunile
  sunt în meniul ⋮ din dreapta.
- Doar lista se derulează; titlul, căutarea și filtrele stau pe loc. Se încarcă
  câte 100 de cazări, iar derularea le aduce pe următoarele.
- **O singură căutare**, după nume de client sau număr de mașină, făcută pe server,
  peste toate cazările. Filtru nou după **locul din depozit**.
- Totalul cazărilor lângă titlu; sub căutare, un sumar: câte cazări, anvelope și
  clienți s-au găsit.
- Fereastra unei cazări are aceleași acțiuni ca meniul, numele clientului e link
  (se deschide în filă nouă), iar sub data cazării scrie câte zile au trecut.
- La cazare nouă, previzualizarea anvelopei arată toate detaliile (profil, indici,
  DOT, observații).
- În PDF, tabelul de anvelope are profilul imediat după marcă.
- **Reparat:** la *Cazare nouă*, căutarea clientului găsește acum și după numărul
  de mașină, ca pagina Clienți (înainte căuta doar în nume și CUI). Lista de
  rezultate arată și numărul de mașină al clientului.
- **Reparat:** *Scoatere și introducere nouă* salvează numărul de mașină pe
  cazarea nouă. Înainte îl pierdea mereu; pentru cazările deja afectate vezi
  secțiunea 2.5.

**Fișa clientului**
- Buton **Editează clientul** (fizică/juridică, CNP/CUI cu completare din ANAF,
  telefon, adresă etc.) — pentru toți utilizatorii, la fel ca în lista Clienți.
- Secțiune **Hotel de anvelope**, dacă clientul are cazări. Click pe o cazare o
  deschide în Hotel anvelope.

**Recepție**
- Antetul stă pe loc, doar lista de devize se derulează.

**AdminV2 › Radar AI › Setări**
- Comutator **Activează / Dezactivează Radar AI** pentru toată platforma.
  Implicit e **pornit**, deci nu se schimbă nimic la deploy.
- Oprit, Radar AI:
  - dispare din meniu și nu mai poate fi deschis nici din adresă;
  - toate rutele `/api/radar/*` (inclusiv căutarea de concurenți) răspund 404;
  - rularile programate (lunea) nu mai pornesc;
  - serviciul Radar nu mai primește cheile AI.

### Tehnic

| Ce | Detalii |
|---|---|
| Migrări noi | `ai01settings` → `imp01import` → `imp02async` → `imp03revert` → `imp04plate` → `imp05loc` → `rad01radar` |
| Tabele noi | `import_sessions`, `import_rows` |
| Coloane noi | `import_sessions.location_id`, `global_settings.radar_enabled` (implicit `true`) |
| Index nou | `ix_cazari_anvelope_plate_data` pe `cazari_anvelope` |
| Dependență nouă | `openpyxl>=3.1.0` (backend) — imaginea backend trebuie reconstruită |
| `deploy/nginx.conf` | blocuri noi pentru `/api/import/` (limită 50 MB, timeout 600 s); intră în imaginea frontend |
| Endpoint-uri noi | `/api/import/*`, `GET /api/cazare-anvelope/summary`, `GET /api/global-settings/features`; parametri noi `q` și `loc_cazare_id` pe `GET /api/cazare-anvelope` |
| API intern Radar | `/api/internal/business-context` răspunde 503 și `/api/internal/ai-config` nu mai dă chei cât timp Radar e oprit |
| Variabile `.env` noi | **niciuna** |
| Serviciul Radar | **neschimbat** (doar monolitul) |

---

## 2. Upgrade în producție

### 2.1. Înainte

1. Adu branch-ul în `MainProd` (pull request `feat/import-clienti` → `MainProd`)
   și verifică diff-ul.
2. Pe server, în tmux, **backup** exact ca în ghid (secțiunea 1.b):
   ```bash
   cd ~/berlinstar/deploy
   docker compose exec -T db pg_dump -U berlinstar berlinstar > backup_Productie_$(date +%Y%m%d_%H%M%S).sql
   ls -lh backup_Productie_*.sql | tail -1      # > 0
   ```
   ⚠️ Păstrează extensia **`.sql`**: e ignorată de git. Nu redenumi backup-ul și
   **nu-l comite** (vezi secțiunea 4).
3. Vezi ce se deployează:
   ```bash
   cd ~/berlinstar && git fetch origin && git log --oneline HEAD..origin/MainProd
   ```

### 2.2. Deploy

```bash
cd ~/berlinstar
./deploy-prod.sh
```

Scriptul reconstruiește toate imaginile (`up -d --build`), deci și backend-ul (cu
`openpyxl`) și frontend-ul (cu noul `nginx.conf`). **Migrările rulează singure**
la pornirea backend-ului (`alembic upgrade head` în `entrypoint.sh`).

Durata migrărilor: câteva secunde. `imp04plate` construiește un index pe
`cazari_anvelope` fără `CONCURRENTLY`, deci scrierile în tabela aceea așteaptă cât
se construiește indexul. La câteva mii de cazări durează sub o secundă. Nu e nevoie
de fereastră de mentenanță.

### 2.3. Verificare după deploy

Pe lângă verificările din ghid (secțiunea 3):

```bash
cd ~/berlinstar/deploy
docker compose exec backend alembic current                    # rad01radar (head)
docker compose exec -T db psql -U berlinstar -d berlinstar -c "\di ix_cazari_anvelope_plate_data"
docker compose exec -T db psql -U berlinstar -d berlinstar -c "select radar_enabled from global_settings;"   # t
docker compose exec frontend grep -c "client_max_body_size 50m" /etc/nginx/conf.d/default.conf              # 2
```

Test manual în aplicație:
- **Configurări › Import**: la admin apar „Clienți” și „Hotel anvelope”, la manager
  doar „Hotel anvelope”.
- **Hotel anvelope**:
  - totalul apare lângă titlu;
  - căutarea după un număr de mașină găsește cazarea;
  - filtrul după loc funcționează;
  - la derulare se încarcă următoarele 100;
  - meniul ⋮ se deschide.
- **Fișa unui client**: butonul „Editează clientul”; secțiunea „Hotel de anvelope”
  apare la un client care are cazări.
- **Recepție**: doar lista se derulează.
- **AdminV2 › Radar AI › Setări**: apare starea „Activ”. Nu opri Radar decât dacă
  chiar vrei.

### 2.4. De verificat o singură dată: cazări fără punct de lucru

Pagina Hotel arată doar cazările punctului de lucru al stației. Cazările mai vechi
fără `location_id` nu apar nicăieri; comportamentul e anterior acestui release,
dar acum se observă mai ușor. Numără-le:

```sql
select account_id, count(*) from cazari_anvelope
 where is_deleted = false and data_checkout is null and location_id is null
 group by account_id;
```

Dacă apar și contul are **un singur** punct de lucru, le poți atribui aceluia:

```sql
-- înlocuiește <ACCOUNT_ID> și <LOCATION_ID>; verifică întâi cu SELECT
update cazari_anvelope set location_id = <LOCATION_ID>
 where account_id = <ACCOUNT_ID> and location_id is null and is_deleted = false;
```

La conturile cu mai multe puncte de lucru, decizia e a firmei.

### 2.5. O singură dată: numărul de mașină pierdut la „Scoatere și introducere nouă”

Până la acest release, cazarea nouă făcută prin **Scoatere și introducere nouă**
se salva mereu **fără număr de mașină**. Bug-ul era prezent din mai 2026 și e
reparat acum în cod. Cazările deja create așa se pot recupera: numărul lor e cel
al cazării scoase, dacă e **același client**. La un client diferit nu se copiază
nimic, ca să nu ajungă o cazare pe mașina altcuiva.

Cazările din fluxul combinat se recunosc după cazarea de referință scoasă în
aceeași zi în care s-a făcut cea nouă, cu același bon (sau amândouă fără bon), și
create înainte de reparație (2026-09-22). E o potrivire aproximativă: referința se
completează și la „Cazare nouă” obișnuită, unde lipsa numărului poate fi voită, iar
fără aceste condiții scriptul ar pune pe cazare numărul altei mașini a clientului.
Rămâne prinsă și „Scoatere → Cazare nouă” din aceeași zi fără mașină aleasă — acolo
mașina e aproape sigur aceeași.

Pe QA (cu varianta inițială, mai largă, a scriptului): 21 de cazări fără număr,
14 recuperate, 7 fără sursă (nici cazarea veche nu avea număr).

1. **Câte sunt:**
   ```bash
   cd ~/berlinstar/deploy
   docker compose exec -T db psql -U berlinstar -d berlinstar -c "
   select n.account_id,
          count(*) as fara_numar,
          count(*) filter (where v.numar_masina is not null) as recuperabile
     from cazari_anvelope n join cazari_anvelope v on v.id = n.referinta_cazare_id
    where n.is_deleted = false and n.numar_masina is null and n.client_id = v.client_id
      and n.data_checkin = v.data_checkout and n.receipt_id is not distinct from v.receipt_id
      and n.created_at < '2026-09-23'
    group by 1 order by 1;"
   ```
2. **Recuperarea.** Rulează în mai multe treceri, pentru că o cazare combinată
   poate porni dintr-o altă cazare combinată fără număr. Id-urile schimbate rămân
   în tabela `_fix_numar_masina_combinata`, ca modificarea să poată fi anulată:
   ```bash
   docker compose exec -T db psql -U berlinstar -d berlinstar -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   CREATE TABLE _fix_numar_masina_combinata (id int PRIMARY KEY, numar_masina text, trecere int,
                                             reparat_la timestamptz DEFAULT now());
   DO $$
   DECLARE n int; t int := 0;
   BEGIN
     LOOP
       t := t + 1;
       WITH upd AS (
         UPDATE cazari_anvelope c SET numar_masina = v.numar_masina
           FROM cazari_anvelope v
          WHERE v.id = c.referinta_cazare_id AND c.client_id = v.client_id
            AND c.data_checkin = v.data_checkout AND c.receipt_id IS NOT DISTINCT FROM v.receipt_id
            AND c.created_at < '2026-09-23'
            AND c.is_deleted = false AND c.numar_masina IS NULL AND v.numar_masina IS NOT NULL
         RETURNING c.id, c.numar_masina)
       INSERT INTO _fix_numar_masina_combinata (id, numar_masina, trecere)
         SELECT id, numar_masina, t FROM upd;
       GET DIAGNOSTICS n = ROW_COUNT;
       EXIT WHEN n = 0 OR t >= 20;
     END LOOP;
   END $$;
   SELECT trecere, count(*) FROM _fix_numar_masina_combinata GROUP BY 1 ORDER BY 1;
   COMMIT;
   SQL
   ```
   Numărul total trebuie să fie cel puțin cât `recuperabile` de la pasul 1. Poate
   ieși puțin mai mare, din cauza lanțurilor reparate în trecerea a doua.
3. **Verificare:** rulează din nou pasul 1. În coloana `recuperabile` trebuie să
   iasă 0; în `fara_numar` rămân doar cazările fără sursă.
4. **Anulare, dacă e nevoie:**
   ```sql
   UPDATE cazari_anvelope c SET numar_masina = NULL
     FROM _fix_numar_masina_combinata f
    WHERE c.id = f.id AND c.numar_masina = f.numar_masina;
   ```
   (Un număr corectat de mână între timp rămâne neatins.)
   Când nu mai e nevoie de ea: `DROP TABLE _fix_numar_masina_combinata;`.

Cazările rămase fără număr se pot completa manual din Hotel anvelope ›
Editează.

---

## 3. Rollback

**Doar cod** (schema rămâne; tabelele noi sunt ignorate de versiunea veche):
exact ca în ghid, secțiunea 5 — `git checkout <commit bun>` și `up -d --build`.
Singura excepție: resetarea conturilor demo din versiunea veche nu știe de
`import_rows`. Dacă un cont demo are importuri, resetarea lui eșuează pe cheia
străină către `clienti`. Coboară și schema (mai jos) sau nu reseta conturi demo cu
importuri.

**Și schema**, dacă e nevoie:
1. Dacă între timp s-au făcut importuri pe care vrei să le anulezi, anulează-le
   **din aplicație, înainte** (sesiunea de import › Anulează). După downgrade,
   istoricul importurilor dispare, dar clienții și cazările create de import rămân.
2. Coboară schema la versiunea de dinainte, **cât rulează încă noul backend**:
   ```bash
   cd ~/berlinstar/deploy
   docker compose exec backend alembic downgrade ai01settings
   ```
   Șterge `import_sessions`, `import_rows`, indexul nou și coloana `radar_enabled`.
3. Deployează codul vechi (ca mai sus).

Ca ultimă soluție: restore din backup-ul de la 2.1 (ghid, secțiunea 5).

---

## 4. De știut

- ⚠️ **Backup-uri de producție în repo.** În `deploy/` sunt comise
  `backup_Productie_*.sqlplus` (dump-uri ale bazei de producție, 80–97 MB fiecare,
  pe `MainProd` și pe alte ramuri), iar repo-ul GitHub e **public**. `.sql` e în
  `.gitignore`, dar `.sqlplus` nu. De făcut:
  - repo-ul trebuie făcut privat;
  - fișierele scoase din istoric (`git filter-repo` / BFG, apoi force-push pe toate
    ramurile);
  - `*.sqlplus` adăugat în `.gitignore`;
  - parolele și cheile din bază considerate compromise.
- **Importurile mari** rulează în fundal, în singurul worker al backend-ului
  (limită 50 MB pe fișier). Nu reporni backend-ul în timpul unui import. O sesiune
  întreruptă apare „eșuată” după 5 minute fără progres și se poate relua.
- **Radar AI oprit:** serviciul Radar ține cheile în memorie un minut, deci oprirea
  se simte în cel mult 60 de secunde. În logul lui, rulările sărite apar ca „context
  indisponibil”.
- **Test cunoscut stricat, anterior acestui release:** `backend/tests/test_route_authorization.py`
  nu pornește, pentru că importă `get_flat_dependant`, care nu mai există în FastAPI
  0.141. Celelalte teste trec:
  - `test_client_import` (19)
  - `test_hotel_import` (17)
  - `test_import_permissions` (2)
  - `test_cazari_search_radar` (3)
