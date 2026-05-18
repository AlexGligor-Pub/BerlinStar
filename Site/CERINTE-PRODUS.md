# BerlinStar — Cerințe de Produs & Strategie de Marketing

> Document de lucru pentru landing page-ul `index.html`
> Piață țintă: **România** (B2B servicii)
> Versiune: 1.0 · 2026-05-18

---

## 1. Poziționare strategică

### One-liner (elevator pitch)
> **BerlinStar este sistemul complet care înlocuiește 5 programe diferite — POS, eFactura ANAF, hotel anvelope, programări și stocuri — pentru vulcanizările, service-urile auto și afacerile de servicii din România.**

### USP (Unique Selling Proposition)
Singurul software de pe piața românească care combină:
1. **Casa de marcat conformă** + **eFactura ANAF automată**
2. **Hotel Anvelope** (modul vertical specializat — nu există la concurență)
3. **Funcționare offline** cu sincronizare automată
4. **Setup în aceeași zi** (vs. săptămâni la ERP-urile clasice)

### Cu cine concurăm și cum ne diferențiem
| Concurent tipic | Slăbiciune | Noi |
|---|---|---|
| Saga / WinMENTOR | Interfață veche, nu e cloud, eFactura ca add-on | Modern, mobile-first, eFactura nativă |
| SmartBill / Oblio | Bun la facturare, slab pe POS și vertical | Vertical complet pentru vulcanizări |
| Soluții POS generice | Lipsește Hotel Anvelope, montaj roți | Modul specific construit din 0 |
| Excel + WhatsApp | Risc fiscal, erori, pierdere clienți | Conformitate + automatizare |

---

## 2. Public țintă (Personas)

### Persona 1 — "Patronul Vulcanizării" (PRIMARĂ)
- **Vârsta:** 35-55 ani
- **Locație:** orașe medii din România (Brașov, Cluj, Timișoara, Constanța, etc.)
- **Cifră de afaceri:** 300.000 — 2.000.000 RON/an
- **Tehnologie:** confortabil cu smartphone, mai puțin cu PC
- **Dureri:**
  - Caietul cu anvelope la hotel se pierde, clienții se supără
  - eFactura ANAF e o sursă de stres permanent
  - Angajații nu mai notează corect ce au făcut
  - Contabilul îl sună panicat sfârșit de lună
- **Trigger de cumpărare:**
  - O amendă ANAF pentru eFactura întârziată
  - Pierderea unui client important pentru că s-a uitat de programare
  - Inventar de an care iese cu diferențe de mii de lei

### Persona 2 — "Managerul Service Auto"
- **Vârsta:** 30-50 ani
- **Mai sofisticat tehnologic** decât persona 1
- **Caută:** profesionalism, raport detaliat pentru clienții flotă
- **Vrea:** ofertă rapidă, deviz, garanție per piesă, istoric VIN

### Persona 3 — "Patroana Salonului / HoReCa"
- **Vârsta:** 28-45 ani
- **Caută:** programări online elegante, fișa clientului, abonamente
- **Punct sensibil:** look & feel al aplicației (recomandă mai departe doar dacă "arată profesionist")

---

## 3. Cerințe funcționale ale paginii web (landing)

### Must-have (LIVRATE în index.html)
- [x] Hero cu valoare clară + CTA principal
- [x] Bara de trust (conformitate OUG 120/2021, ANAF SPV, GDPR)
- [x] Secțiune "Probleme" cu 4 dureri reale + soluție vizibilă
- [x] Grilă de 9 funcționalități cu 2 marcate ca "exclusiv"
- [x] Secțiune dedicată eFactura ANAF cu mockup de status
- [x] 6 industrii target cu tag-uri
- [x] Pași onboarding (1-2-3-4)
- [x] 3 pachete de preț cu pachet recomandat evidențiat
- [x] FAQ cu 8 întrebări reale
- [x] CTA final cu formular (nume, firmă, telefon)
- [x] Footer complet
- [x] WhatsApp floating button (sticky)
- [x] Hamburger menu pe mobile
- [x] Toate textele în limba română
- [x] Mobile-first (3 breakpoint-uri: 0, 640px, 960px)
- [x] Schemă de culori: navy + auriu (premium, „star")
- [x] Animații subtile la scroll
- [x] Zero dependențe externe în afară de fonturi Google

### Nice-to-have (de adăugat în iterații viitoare)
- [ ] Video demo de 90 secunde în hero (placeholder pregătit)
- [ ] Testimoniale reale cu poză client (după primii 10 clienți)
- [ ] Carusel logos clienți („Folosit de 200+ vulcanizări")
- [ ] Calculator ROI („Cât economisesc pe lună?")
- [ ] Blog / Resurse (SEO long-tail)
- [ ] Pagina legală /termeni-si-conditii și /politica-confidentialitate
- [ ] Integrare HubSpot/Pipedrive pentru lead-uri
- [ ] Analytics (GA4 + Hotjar + Facebook Pixel)
- [ ] Versiune AMP pentru SEO mobil

---

## 4. Selling Points (top 10, prioritizate)

1. **„Singurul cu Hotel Anvelope nativ."** — diferențiator vertical greu de copiat
2. **„eFactura ANAF în 60 de secunde, automat."** — rezolvă durerea legală #1 a anului
3. **„Conform OUG 120/2021 din prima zi."** — eliminăm riscul amenzilor
4. **„Funcționează și fără internet."** — credibilitate la magazine din zone rurale
5. **„Setup în aceeași zi, fără consultanți."** — vs. săptămâni la concurență
6. **„14 zile gratuit, fără card."** — eliminăm friction-ul de probă
7. **„199 RON/lună, fără TVA ascuns."** — preț previzibil
8. **„Made in Romania."** — suport în română, înțelegem legislația locală
9. **„O singură aplicație în loc de 5."** — economie 400-800 RON/lună
10. **„Mobile-first."** — patronul vede dashboard din mașină

---

## 5. Cerințe tehnice pentru pagină

### Performanță
- **Single HTML file** (cerință utilizator) — fără build, fără bundler
- **First Contentful Paint < 1.5s** pe 4G
- **Total page weight < 200 KB** fără imagini
- **Doar fonturi externe** (Google Fonts cu `preconnect`)
- **Vanilla CSS + JS** — zero dependențe runtime

### Accesibilitate (WCAG 2.1 AA)
- Contrast minim 4.5:1 pentru text normal
- Toate butoanele cu `aria-label` unde nu există text
- Focus visible
- `prefers-reduced-motion` respectat
- Navigare cu tastatura

### SEO
- Meta description, OG tags, locale `ro_RO`
- Structured data (JSON-LD `Product` / `Organization`) — de adăugat
- Heading hierarchy corectă (un singur h1)
- URL-uri prietenoase la viitoarele pagini

### Mobile-first
- Breakpoint-uri: `640px` (tabletă), `960px` (desktop)
- Touch targets minim 44×44 px
- Hamburger menu sub 860px
- Hero stack vertical sub 960px
- WhatsApp FAB sticky pentru contact rapid

---

## 6. Imagini recomandate (de pus în `Site/images/`)

| Nume fișier | Descriere | Unde apare | Dimensiune sugerată |
|---|---|---|---|
| `dashboard.png` | Screenshot dashboard real (anonimizat) | Hero (înlocuiește mockup CSS) | 1200×800, retina 2x |
| `hotel-anvelope.jpg` | Foto cu depozit anvelope ordonat, etichete | Sectiune "Hotel Anvelope" | 1000×700 |
| `efactura-pdf.png` | Mockup factură PDF cu sigiliu ANAF | Lângă mockup status | 600×800 |
| `montaj-roti.jpg` | Foto angajat la montaj, calitate profesionistă | Modul "Montaj Roți" | 1000×700 |
| `mobile-app.png` | Trei telefoane cu screenshot-uri | Sub stats | 800×600 |
| `team-photo.jpg` | Echipa BerlinStar (de adăugat la lansare) | Footer / Despre | 800×500 |
| `logo.svg` | Logo vectorial principal | Header (opțional, înlocuiește ★ CSS) | scalable |
| `favicon.ico` + `favicon.svg` | Favicon pentru tab | Head | 32×32, 16×16 |
| `og-image.jpg` | Imagine social share | OG meta | 1200×630 |

**Format recomandat:** WebP cu fallback JPG/PNG. Adăugare ulterioară prin `<picture>` pentru responsive.

---

## 7. Strategia de lansare (90 zile)

### Săptămâna 1-4 — Soft launch
- Demo live la 10 vulcanizări selectate (gratuit + feedback)
- 3 testimoniale video înregistrate
- Pagina live, fără reclame plătite

### Săptămâna 5-8 — Conținut & SEO
- 5 articole blog: „Cum funcționează eFactura", „Ghid Hotel Anvelope", etc.
- Optimizare Google Maps pentru fiecare client pilot
- Cazuri de succes pe LinkedIn

### Săptămâna 9-12 — Plătit
- Facebook/Instagram ads geo-targetate (vulcanizări, raze de 50km de oraș)
- Google Ads pe „casa de marcat vulcanizare", „eFactura ANAF software"
- Demo gratuit la Romexpo / Auto Show

### KPI 90 zile
- 50 lead-uri calificate
- 20 demo-uri realizate
- 10 clienți semnați (target conservator)
- Cost de achiziție client (CAC) < 2.000 RON

---

## 8. Compliance & legal (de pregătit)

- [ ] Politica de confidențialitate (GDPR)
- [ ] Termeni și condiții
- [ ] Politică cookies (banner)
- [ ] Înregistrare ANSPDCP (autoritatea protecției datelor)
- [ ] Certificat SSL (Let's Encrypt)
- [ ] Înregistrare marcă „BerlinStar" la OSIM
- [ ] Verificare că nu există conflict marcă în UE
