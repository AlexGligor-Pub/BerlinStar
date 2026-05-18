# Imagini pentru landing page BerlinStar

Acest folder este pentru fotografiile reale ale produsului și pentru screenshot-urile aplicației.
Până când adaugi imaginile, landing page-ul folosește mockup-uri pure CSS care arată profesionist.

## Listă completă cu imagini de produs

### 🎯 Prioritate înaltă (de pus primele)

| Fișier așteptat | Descriere | Cum o folosim |
|---|---|---|
| **dashboard.png** | Screenshot real al dashboard-ului BerlinStar (date anonime) | Înlocuiește mockup-ul CSS din hero |
| **hotel-anvelope.jpg** | Foto profi cu un depozit de anvelope ordonat, etichete cu coduri | Lângă cardul „Hotel Anvelope" |
| **logo.svg** | Logo BerlinStar vectorial | Înlocuiește ★ din header (rămâne fallback dacă lipsește) |
| **favicon.svg** + **favicon.ico** | Iconițe pentru tab browser | În `<head>` |
| **og-image.jpg** (1200×630) | Card social media (Facebook/LinkedIn share) | Meta `og:image` |

### 📸 Prioritate medie

| Fișier așteptat | Descriere |
|---|---|
| **mobile-app.png** | 3 telefoane cu screenshot-uri ale aplicației |
| **montaj-roti.jpg** | Foto profi cu mecanic la montaj |
| **efactura-success.png** | Captură ecran „eFactura trimisă cu succes" |
| **pos-tablet.jpg** | Operator folosind aplicația pe tabletă, în magazin |
| **team-photo.jpg** | Echipa BerlinStar (de adăugat când e gata) |

### 🎨 Specificații tehnice

- **Format ideal:** WebP (cu fallback JPG/PNG)
- **Compresie:** sub 200 KB per imagine, sub 100 KB ideal
- **Dimensiuni:** 1× pentru desktop, 2× pentru retina
- **Tool recomandat:** [squoosh.app](https://squoosh.app/) pentru optimizare
- **Stil fotografic:** lumină naturală, fundaluri curate, oameni reali (nu stock-uri evidente)

## Cum integrezi imaginile în HTML

După ce pui o imagine în acest folder, în `index.html` poți:

**1) Înlocuiește mockup-ul din hero:**
```html
<!-- Înlocuiește div-ul .mock-screen cu: -->
<img src="images/dashboard.png" alt="Dashboard BerlinStar" loading="lazy" />
```

**2) Adaugă imagine la o secțiune existentă:**
```html
<div class="feature-card">
  <img src="images/hotel-anvelope.jpg" alt="Hotel Anvelope" style="border-radius: 12px; margin-bottom: 16px;" loading="lazy" />
  <h3>Hotel Anvelope</h3>
  ...
</div>
```

**3) Adaugă favicon în `<head>`:**
```html
<link rel="icon" type="image/svg+xml" href="images/favicon.svg" />
<link rel="icon" type="image/x-icon" href="images/favicon.ico" />
<meta property="og:image" content="images/og-image.jpg" />
```

## Surse legale de imagini

Dacă nu ai încă fotografii proprii, poți folosi temporar (gratuit, comercial OK):

- **[Unsplash](https://unsplash.com/s/photos/tire-shop)** — fotografii profi gratuite
- **[Pexels](https://www.pexels.com/search/auto%20service/)** — același tip
- **[Heroicons](https://heroicons.com/)** — iconițe SVG (deja folosim inline SVG)

**ATENȚIE:** verifică licența. Imagini cu fețe identificabile = nevoie de model release.

## Optimizare CDN (viitor)

Când lansăm public, recomand:
- **Cloudflare Images** sau **Cloudinary** pentru servire automată WebP + responsive
- **Lazy loading** deja activat în HTML cu `loading="lazy"`
- **`<picture>` element** pentru art direction (imagine diferită pe mobil vs desktop)
