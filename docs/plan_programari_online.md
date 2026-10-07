# Programări online — plan de implementare

Document de lucru pentru echipă. Pornește de la `garage-booking-spec.md` și de la ce
există azi în cod. Branch: `feat/programari-online`, pornit din `MainProd` (`69f2dc7`).

## 1. Ce avem și ce lipsește

**Avem:**
- **Multi-tenancy.** Tenantul este `Account`. Fiecare tabelă are `account_id`, iar
  scoparea se face manual, prin `Depends(get_account_id)` (`app/dependencies.py`).
- **Programări** (`models/programare.py`, `routers/programare.py`). O programare are
  `location_id` obligatoriu și, opțional, `client_id`, `department_id` și
  `employee_id`. Are `start_time`/`end_time` și statusurile Programat, In lucru,
  Executat, Anulat.
- **Clienți și vehicule** (`clienti`, `client_vehicole`), cu normalizare de număr de
  înmatriculare (`utils/plate.py`).
- **Date pentru disponibilitate:** concediile angajaților (`leaves`) și sărbătorile
  legale (`utils/romanian_holidays.py`).
- **Rate limiting:** slowapi (`app/rate_limit.py`) și un throttle în memorie
  (`utils/login_throttle.py`), refolosibil ca model.
- **Setări per cont** în `general_settings`, plus datele firmei în `companies`
  (nume, adresă, telefon, logo).

**Lipsește:**
- **Verificare de suprapunere.** Nu există deloc, nici în cod, nici în bază.
  `test_no_overlap_limit` confirmă intenționat că 5 programări identice sunt
  permise.
- **Program de lucru.** Nu e configurat în backend. Frontend-ul are 8–17 hardcodat
  în `Programari.tsx:22-30`.
- **Chei API și rute publice.** Nu există nicio cheie API și nicio rută publică,
  neautentificată cu JWT, pentru programări.
- **Normalizarea telefonului.** Există doar în importul de clienți.
- **IP-ul real al clientului.** Nu ajunge la backend: lanțul e
  Caddy → nginx (frontend) → backend, iar uvicorn are încredere doar în 127.0.0.1.
  Orice limită „per IP” ar fi azi, practic, globală.

## 2. Decizii de arhitectură

1. **Berlin Star rămâne sursa de adevăr.** O programare online este un rând normal în
   `programari`. Apare imediat în pagina Programări, lângă cele introduse la recepție,
   și ocupă capacitate la fel ca ele.
2. **Logica de rezervare stă într-un singur serviciu,**
   `services/booking_service.py` (disponibilitate, creare, căutare, anulare).
   Ruta publică și serverul MCP îl apelează pe același.
3. **Blocarea atomică a slotului:**
   - La creare se ia `pg_advisory_xact_lock(account_id, location_id, zi)`, apoi se
     numără programările active care se suprapun (inclusiv cele interne) și se
     compară cu capacitatea.
   - Dacă e loc, se inserează rândul și se face commit.
   - Două cereri simultane pe aceeași zi se serializează, iar a doua primește
     **409 Slot ocupat**.
   - Am ales lock-ul, și nu un exclusion constraint, pentru că o locație poate avea
     capacitate > 1 (mai multe elevatoare) și pentru că trebuie numărate și
     programările introduse de mână.
   - În testele SQLite lock-ul e no-op. Concurența se testează separat, pe Postgres,
     în QA.
4. **Cheia API nu ajunge niciodată în browser.**
   - Site-ul public este un container nginx care servește aplicația și face proxy
     pentru `/api/`. Adaugă `X-Api-Key` din variabila de mediu, prin template-urile
     `envsubst` ale imaginii oficiale nginx.
   - Browserul vorbește doar cu domeniul garajului.
   - Proxy-ul trimite și IP-ul clientului în `X-Client-IP`. Backend-ul îl ia în
     considerare **doar** când cererea vine cu o cheie validă.
5. **Portabil pe orice domeniu.** Aplicația publică se construiește o singură dată,
   cu `base: './'` și fără router. Tot ce e specific unui garaj vine la rulare, din
   variabile de mediu și din `GET /config`. Aceeași imagine merge la `testservice.ro`
   și la `professorprime.ro/public-calendar`.
6. **Stack.** Folosim tot SolidJS + Vite, ca frontend-ul existent, într-un director
   nou: `public-calendar/`.

## 3. Numele site-ului

Cerință: **numele din interfața cu clientul este configurabil, iar valoarea implicită
este „Vulcanizare Alex”.**

- **Unde se configurează:** coloana `booking_settings.site_name`, cu
  `server_default 'Vulcanizare Alex'`, editabilă din Configurări › Programări online.
- **Cum ajunge pe site:** `GET /api/public/v1/config` îl întoarce. Site-ul public îl
  folosește în titlul paginii (`<title>`), în antet, în mesajul de confirmare și în
  meta-tagurile pentru share.
- **Suprascriere per instalare:** variabila opțională `SITE_NAME` din containerul
  public are prioritate. Utilă când același garaj are două domenii.
- **Fallback:** dacă API-ul nu răspunde, site-ul afișează tot „Vulcanizare Alex”.
  Valoarea stă într-o singură constantă, `DEFAULT_SITE_NAME`, în
  `public-calendar/src/config.ts`.
- **Pe server:** numele implicit e tot constantă (`DEFAULT_SITE_NAME` în
  `app/models/booking_settings.py`) și se folosește în migrare și în schema Pydantic.
  Nu se scrie de mână în mai multe locuri.

## 4. Model de date (migrare `onl01_programari_online.py`)

**`booking_settings`** — o configurare per locație care primește programări online:

| Câmp | Tip | Implicit |
|---|---|---|
| `account_id`, `location_id` | FK, unic împreună | — |
| `enabled` | bool | false |
| `site_name` | String(120) | `'Vulcanizare Alex'` |
| `department_id` | FK, opțional | în ce divizie intră programările online |
| `slot_minutes` | int | 60 |
| `capacity` | int | 1 (câte programări simultane acceptă locația) |
| `lead_minutes` | int | 120 (cu cât timp înainte se mai poate rezerva) |
| `horizon_days` | int | 30 |
| `cancel_cutoff_minutes` | int | 120 |
| `closed_on_holidays` | bool | true |

**`booking_hours`**: `booking_settings_id`, `weekday` (0–6), `open_time`, `close_time`.
Poate avea mai multe intervale pe zi, pentru pauza de masă.

**`booking_services`** (opțional în v1): `name`, `duration_minutes`, `active`. De
exemplu „Schimb anvelope — 30 min”. Dacă lista e goală, se folosește `slot_minutes`.

**`public_api_keys`**:
- Câmpuri: `account_id`, `location_id`, `name`, `prefix` (primele 8 caractere,
  pentru afișare), `key_hash` (SHA-256), `created_at`, `last_used_at`, `revoked_at`.
- Cheia se afișează o singură dată, la generare.

**Coloane noi pe `programari`:**
- `source`: enum `intern` / `web` / `mcp`, implicit `intern`
- `public_ref`: String(12), unic per cont; codul pe care îl primește clientul, de
  forma `BS-7K3Q9`
- `contact_nume`, `contact_telefon`, `telefon_normalizat` (+ index pe
  `(account_id, telefon_normalizat)`)
- `vehicul_marca`, `vehicul_model`, `vehicul_an`: opționale, text liber
- `client_ip`: doar pentru `web`; pe MCP IP-ul e al furnizorului AI, deci nu se
  salvează
- `booking_service_id`: FK, opțional

**Legătura cu clientul:**
- Dacă telefonul normalizat se potrivește cu un client existent al contului, se
  completează `client_id`.
- Altfel **nu se creează automat un client**. Recepția îl creează la prima vizită,
  dintr-un buton „Creează client din programare”.
- Motivul: datele online sunt neverificate. Nu vrem clienți duplicați sau spam în
  `clienti` (vezi și `plan_gdpr.md`).

**Utilitar nou:** `utils/phone.py` → `normalize_phone()`. Scoate spațiile și
separatorii și aduce numărul la forma `+40…` pentru numerele românești (`07…`,
`0040…`, `40…`). Numerele străine rămân în forma E.164, dacă se pot interpreta.

## 5. API public — `/api/public/v1`

Autentificarea se face cu `X-Api-Key`, printr-o dependență nouă,
`get_public_booking_context`. Ea întoarce contul, locația și `booking_settings` și
respinge cererea dacă cheia e revocată sau programările online sunt dezactivate.

| Metodă | Rută | Rol |
|---|---|---|
| GET | `/config` | numele site-ului, datele garajului (din `companies`), serviciile, orizontul, linkul MCP |
| GET | `/slots?from=&to=&service_id=` | sloturile libere; maximum 31 de zile pe cerere |
| POST | `/bookings` | creează programarea: **201** cu `{ref, start, end, status: "confirmed"}`, sau **409** dacă slotul s-a ocupat |
| GET | `/bookings?phone=` | programările viitoare ale unui telefon (lookup neverificat, v1) |
| GET | `/bookings/{ref}?phone=` | o programare; cere ref-ul și telefonul |
| POST | `/bookings/{ref}/cancel` | anulare de către client, cu ref și telefon, până la `cancel_cutoff_minutes` înainte |

**Cum se calculează disponibilitatea:**
1. Pornim de la programul zilei.
2. Scădem sărbătorile legale.
3. Scădem trecutul și `lead_minutes`.
4. Tăiem ziua în sloturi de `slot_minutes`.
5. Păstrăm doar sloturile în care `capacity` minus programările active suprapuse
   este mai mare decât 0.

Concediile angajaților nu intră în v1, pentru că programarea online nu e legată de
un angajat anume.

**Ce întoarce lookup-ul după telefon:** doar ref, data, ora, serviciul și statusul.
Fără descriere și fără nume, pentru că lookup-ul e neverificat (§7 din spec).

**Validare:**
- Numele: 2–100 de caractere. Telefonul trebuie să se poată normaliza. Descrierea:
  maximum 500 de caractere. Anul: între 1950 și anul curent + 1.
- Există un câmp honeypot. Dacă e completat, cererea e respinsă fără explicații.

**Limite:**
- POST `/bookings`: 5 pe oră per IP și cel mult 3 programări viitoare active per
  telefon.
- GET `/bookings`: 20 pe oră per IP.
- Per cheie API: o limită globală de siguranță.

## 6. Pașii, în ordine

### Etapa 0 — Pregătire (0,5 zile)
- **IP-ul real, cap-coadă:**
  - Caddy trimite deja `X-Forwarded-For`.
  - În `deploy/nginx.conf`: `set_real_ip_from` pe rețeaua `web`, plus
    `real_ip_header X-Forwarded-For`.
  - În backend: `FORWARDED_ALLOW_IPS` pentru containerul nginx.
  - Verificăm în QA că `request.client.host` arată IP-ul real. Asta repară și
    limitele slowapi existente, care azi sunt, practic, globale.
- `utils/phone.py` și testele lui.

### Etapa 1 — Backend: nucleul de rezervare (2–3 zile)
- Modelele și migrarea `onl01`.
- `services/booking_service.py`: `list_slots`, `create_booking` (cu lock-ul),
  `find_by_phone`, `get_booking`, `cancel_booking`.
- Router-ul `routers/public_booking.py`, montat la `/api/public/v1`, cu dependența
  pe cheia API și limitele de mai sus.
- Endpoint-uri interne (JWT, rolul SETTINGS):
  - `GET`/`PUT /api/booking-settings`
  - CRUD pentru program și servicii
  - `POST`/`DELETE /api/public-api-keys`
- **Teste** (`tests/test_public_booking.py`, în stilul celor existente):
  - sloturi, pentru fiecare regulă de mai sus
  - capacitate atinsă → 409
  - programările interne ocupă capacitate
  - cheie revocată → 401
  - lookup-ul nu întoarce date personale
  - anularea după limită → refuzată
  - `site_name` implicit = „Vulcanizare Alex”
- **Test de concurență pe Postgres, în QA:** un script care trimite 20 de cereri
  simultane pe același slot, cu capacitate 1. Exact una trebuie să reușească.

### Etapa 2 — Berlin Star: configurare și vizibilitate (1,5–2 zile)
- **Configurări › Programări online**, panou nou. Conține activarea, **numele
  site-ului** (precompletat cu „Vulcanizare Alex”), locația, divizia, programul pe
  zile, durata slotului, capacitatea, serviciile și cheile API.
  - O cheie nouă se afișează o singură dată, cu buton de copiere.
  - Panoul are o previzualizare a antetului site-ului public.
- **Pagina Programări:**
  - insignă „Online” / „AI” pe programările cu `source` ≠ `intern`
  - telefonul, mașina și descrierea în detalii
  - butonul „Creează client din programare”
- Programul hardcodat din `Programari.tsx` se citește din `booking_settings` când
  există, cu 8–17 ca valoare implicită.
- Traduceri RO, EN și HU, plus secțiune nouă în `frontend/src/docs/content/programari.*.md`.

### Etapa 3 — Site-ul public (2–3 zile)
- **`public-calendar/`**, aplicație SolidJS + Vite, fără router, cu trei ecrane:
  1. alegerea zilei și a orei
  2. datele clientului (numele, telefonul și descrierea sunt obligatorii; marca,
     modelul și anul sunt opționale)
  3. confirmarea, cu ref-ul
- **Pe lângă cele trei ecrane:**
  - o secțiune „Programările mele”, după telefon, cu opțiune de anulare
  - butonul „Conectează asistentul AI” (etapa 4)
  - antetul cu **numele site-ului** din `/config`, cu fallback „Vulcanizare Alex”
- Mobile-first, în română. Fără cookie-uri de tracking, cu link spre nota de
  informare GDPR.
- **`deploy/public-calendar.Dockerfile`:** build cu Vite, apoi nginx cu un template:

  ```nginx
  location /api/ {
      proxy_pass ${BERLINSTAR_URL}/api/public/v1/;
      proxy_set_header X-Api-Key ${BERLINSTAR_API_KEY};
      proxy_set_header X-Client-IP $remote_addr;
  }
  ```

- **Configurarea unei instalări:** `BERLINSTAR_URL`, `BERLINSTAR_API_KEY`,
  `SITE_NAME` (opțional). Plus domeniul, pus în Caddy.
- **Prima instalare, pe serverul actual:**
  - serviciu nou `public-calendar` în `docker-compose.yml`
  - ruta `/public-calendar/` în `nginx.conf`
  - CSP separată pe secțiune, prin `map $uri $csp`, ca la `/berlinstar`
- `deploy/.env.example`: cheile noi, fără valori.

### Etapa 4 — Serverul MCP (3–4 zile, după ce 1–3 sunt stabile)
- Pachetul oficial Python `mcp`, transport Streamable HTTP, montat în backend la
  `/mcp/{cod_garaj}`. Codul garajului identifică contul; pentru un domeniu
  personalizat se poate folosi și o cheie.
- **Unelte**, toate apelând `booking_service`:
  - `list_available_slots`
  - `create_booking`
  - `get_booking`
  - `cancel_booking`

  Fiecare are o descriere clară, în engleză, cu exemple de parametri.
- `source = 'mcp'`, fără IP. Limitele sunt per telefon și per client OAuth.
- **OAuth 2.1** (cerut de spec): Berlin Star devine authorization server, cu
  Dynamic Client Registration, ca să meargă direct din Claude și ChatGPT.
  - Utilizatorul care aprobă este clientul final, identificat în v1 doar prin telefon.
  - Aici e cel mai mare risc de estimare. Propunem un prototip de o zi înainte de
    angajament.
- **Linkul „Conectează asistentul AI”** de pe site-ul public, cu URL-ul serverului
  precompletat.

### Etapa 5 — După v1 (neprogramat)
- Notificări: SMS sau email de confirmare și memento.
- Cod SMS unic la lookup (închide slăbiciunea asumată din §7 al specificației).
- Politica pentru neprezentări și, eventual, avans.
- Evenimentul „programare nouă” în timp real în Berlin Star. Există deja SSE pentru
  recepții și se poate extinde.

**Total estimat v1** (etapele 0–3): **6–8,5 zile**. MCP: încă **3–4 zile**.

## 7. Ce trebuie decis

1. **Clientul la programarea online:** doar legătură, dacă telefonul există deja
   (propunerea noastră), sau creare automată de client?
2. **Capacitatea:** un număr per locație (propunerea pentru v1), sau resurse numite
   (Elevator 1, Elevator 2) cu alocare explicită?
3. **Serviciile cu durate diferite** intră în v1, sau începem cu un singur tip de slot?
4. **Anularea de către client:** o permitem în v1, cu ref și telefon, până la 2 ore
   înainte? MCP-ul are nevoie de ea, dar specificația o lasă nedefinită.
5. **Notificarea recepției** la o programare nouă: suficient că apare în calendar,
   sau vrem sunet sau push din prima?
6. **OAuth pentru MCP:** acceptăm pentru prima versiune un flux simplificat (clientul
   își confirmă numele și telefonul pe pagina de aprobare)?

## 8. Atenție înainte de merge

- `garage-booking-spec.md` conține, în secțiunea 11, parola mașinii de QA. Repo-ul e
  public, așa că specificația **nu** intră în git în forma asta.
- `QA.md`, care e deja în repo, conține parole în clar. Ține de aceeași curățenie ca
  în `plan_gdpr.md` §4.
- Rutele publice sunt primele din aplicație fără JWT. Înainte de producție, un
  review de securitate pe `routers/public_booking.py` și pe configurarea nginx.
