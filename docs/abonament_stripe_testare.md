# Abonament BerlinStar — testare plăți Stripe (card, Google Pay, PayPal, QR)

## 1. Precondiții

1. **Migrație DB**: `cd backend && venv/bin/alembic upgrade head` (head: `sub02checkout`).
   Docker: copiază migrația în container (`docker compose cp`) și rulează `alembic upgrade head` acolo.
2. **Cheie Fernet eFactura** configurată (cheile Stripe sunt criptate cu ea).
3. **Date emitent complete** (AdminV2 → Abonament → Setări: nume, CUI, adresă, județ, IBAN etc.) — altfel `POST /checkout*` întoarce 400 cu lista câmpurilor lipsă.
4. **Chei Stripe de test**: Dashboard Stripe → *Test mode* ON → Developers → API keys → `pk_test_…` / `sk_test_…`.
   În AdminV2 → Abonament: bifează **Mod test**, lipește cheile. Backend-ul refuză combinația `Mod test` + `sk_live_` (și invers).
5. **Preț / TVA / monedă**: `subscription_price_eur` este tratat ca **preț brut, TVA inclus**. Moneda de încasare
   (`RON` sau `EUR`) se alege din același panou. Factura se emite mereu în RON la curs BNR.

## 2. Webhook (opțional în dev)

Fluxul funcționează **și fără webhook**: frontend-ul face polling la `GET /api/subscription/payments/{id}`
și, la fiecare al 4-lea tick, `POST /api/subscription/payments/{id}/sync`, care reconciliază starea direct din Stripe.
Butonul „Am plătit — verifică” face același lucru la cerere.

Pentru a testa și webhook-ul local:

```bash
stripe login
stripe listen --forward-to localhost:4000/api/subscription/webhook
```

Copiază `whsec_…` afișat în AdminV2 → Abonament → *Webhook secret*. Evenimente relevante:
`payment_intent.succeeded|payment_failed|canceled|processing`, `checkout.session.completed|async_payment_succeeded|async_payment_failed|expired`.
Handler-ul e idempotent; la eroare răspunde 500 ca Stripe să reîncerce.

## 3. Fluxul QR (Google Pay / Apple Pay / PayPal / card pe telefon)

1. Configurări → Abonament → **Plătește**.
2. Alege compania, emailul, metoda **„Pe telefon, scanând un cod QR”** → *Generează codul QR*.
3. Backend creează un **Stripe Checkout Session** (hosted, `checkout.stripe.com`, expiră în 30 min) și întoarce URL-ul; frontend-ul îl randează ca QR.
4. Scanează cu telefonul. Pagina Stripe afișează automat metodele active în Dashboard → Settings → Payment methods.
5. Desktopul detectează plata prin polling (3 s) sau la „Am plătit — verifică”; la `succeeded` se emite factura + eFactura în fundal.
6. Dacă telefonul revine pe `success_url` (`…/configurari?topic=abonament&payment=success&payment_id=N`), panoul Abonament face `sync` și afișează statusul.

### Google Pay (test)
- Activează *Google Pay* în Dashboard → Payment methods (Test mode). Pagina hosted e pe HTTPS, deci nu trebuie înregistrat domeniul.
- Telefon Android cu Chrome, logat în Google, cu **un card real salvat** în Google Wallet — altfel butonul nu apare. În test mode Stripe nu debitează cardul real; poți adăuga și cardurile din *Google Pay test card suite*.
- Alternativ pe desktop: Chrome logat în Google cu un card salvat → butonul apare direct pe pagina Stripe (link „Deschide pagina de plată pe acest dispozitiv”).

### Apple Pay (test)
- Merge cu **RON** (spre deosebire de PayPal) și pe Checkout hosted nu necesită nicio configurare/înregistrare de domeniu (doar Payment Element încorporat ar cere-o).
- iPhone/iPad/Mac cu **Safari**, logat în iCloud, cu **un card real în Apple Wallet**. Cardurile de test Stripe/Apple nu pot fi adăugate în Wallet; cu chei `sk_test_` Stripe returnează un token de test și **nu debitează** cardul real.
- Butonul Apple Pay apare automat pe pagina Stripe deschisă din QR; dacă nu apare, verifică pe https://docs.stripe.com/testing/wallets ce cerință lipsește (Safari, card în Wallet).
- În istoric metoda apare ca „Apple Pay”.

### PayPal (test)
- **PayPal prin Stripe nu suportă RON.** Setează moneda de încasare **EUR** în AdminV2 → Abonament. Factura rămâne în RON (curs BNR).
- Activează *PayPal* în Dashboard → Payment methods (Test mode).
- Pe pagina Stripe alege PayPal → *Pay*. În test mode Stripe simulează aprobarea, fără cont PayPal sandbox. Dacă PayPal apare ca buton separat, e nevoie de un cont PayPal Sandbox personal.
- În istoric metoda apare ca „PayPal” (coloana *Metodă*).

### Card
- Carduri test: `4242 4242 4242 4242` (succes), `4000 0000 0000 9995` (fonduri insuficiente → `failed`),
  `4000 0025 0000 3155` (3DS). Orice dată viitoare / CVC.
- Metoda „Card, aici în pagină” folosește Payment Element încorporat; după confirmare modalul așteaptă confirmarea reală (polling), nu închide imediat.

## 4. Verificări după plată

- Configurări → Abonament: status *Activ*, „Următoarea plată” +12 luni, rândul în istoric cu *Metodă*, *Perioadă*, *Status*, apoi *Factură* și *ZIP ANAF* (după emitere).
- Badge „STRIPE TEST” pe panou / „TEST” pe modal când cheile sunt de test.
- Stripe Dashboard → Payments: metadata `payment_id`, `account_id`, `cui`.

## 5. Teste automate backend

```bash
cd backend && venv/bin/python -m tests.run_all            # tot
cd backend && venv/bin/python -m tests.test_subscription_stripe
```

Acoperă: an bisect la reînnoire, calcul sume RON/EUR, webhook duplicat idempotent, PI eșuat, sesiune expirată, `sync_payment`.
