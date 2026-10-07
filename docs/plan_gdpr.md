# GDPR în BerlinStar — ce cere legea și ce avem de construit

Document de lucru pentru echipă. Nu e consultanță juridică: textele livrate de noi
sunt modele, pe care fiecare client le validează cu juristul lui.

## 1. Ce obligații are un service auto sau o vulcanizare

Un service prelucrează date personale în fiecare fișă: nume, telefon, adresă,
CNP sau CUI la facturare, numărul de înmatriculare, seria de șasiu, kilometrajul,
istoricul lucrărilor. Numărul de înmatriculare și seria de șasiu sunt date
personale atunci când duc la o persoană fizică, deci intră sub aceleași reguli ca
numele.

**Obligațiile care contează pentru noi:**

1. **Informarea clientului** înainte sau în momentul colectării: cine e operatorul,
   ce date ia, în ce scop, pe ce temei, cât le ține, cui le dă mai departe, ce
   drepturi are clientul și pe ce adresă și le exercită. Asta e „nota de informare”.
2. **Temeiul corect.** Pentru reparație și facturare temeiul e executarea
   contractului și obligația legală, **nu** consimțământul. E o greșeală frecventă
   să ceri semnătură „pentru GDPR” la lucrări obișnuite: dacă temeiul e contractul,
   consimțământul nu se cere și nici nu poate fi retras.
3. **Consimțământ separat, doar pentru marketing:** SMS-uri și emailuri cu oferte
   sau memento la ITP și schimbul de anvelope. Se cere bifat explicit, se poate
   retrage la fel de ușor, iar dovada bifei trebuie păstrată.
4. **Registrul activităților de prelucrare** (art. 30). Scutirea sub 250 de
   angajați aproape nu se aplică în practică, fiindcă prelucrarea datelor
   clienților și ale angajaților nu e ocazională. E primul lucru cerut la control.
5. **Contracte cu împuterniciții** (art. 28): contabilitate, IT, furnizorul de
   software. **BerlinStar e persoană împuternicită pentru fiecare client**, deci
   are nevoie de un astfel de contract semnat cu fiecare cont.
6. **Păstrarea limitată.** Documentele financiar-contabile au termenele lor legale,
   iar restul datelor se păstrează cât e nevoie pentru scop, apoi se șterg sau se
   anonimizează. Termenele se scriu în nota de informare.
7. **Drepturile clientului:** acces, rectificare, ștergere, restricționare,
   portabilitate, opoziție. Trebuie să le putem onora în 30 de zile.
8. **Breșe de securitate:** notificare la ANSPDCP în 72 de ore.
9. **Camerele de supraveghere**, dacă există în service: semnalizare la intrare,
   informare separată, doar zonele justificate. Autoritatea a dat amenzi exact pe
   camere montate fără temei clar.

## 2. Ce avem deja în aplicație

- **Disclaimere** per cont (`disclaimers`), legate de locație și tipărite pe
  documente prin `drawDisclaimer` — mecanismul de text pe PDF există deja.
- **Setări generale** per cont (`general_settings`), cu comutatoare de afișare.
- **Semnături** pe PDF: „Semnatura Angajat” și „Semnatura Client”.
- Nicăieri nu apare cuvântul GDPR: nu există notă de informare, nici bifă de
  marketing, nici export sau ștergere de date la cerere.

## 3. Planul, pe etape

### Etapa 1 — Textul GDPR configurabil și tipărit (minimul legal)

**Configurări › GDPR și protecția datelor**, panou nou, la nivel de cont:

| Câmp | Rol |
|---|---|
| Nota scurtă | 2–4 rânduri, tipărite pe documente |
| Nota completă | textul integral, pentru afișare la recepție și pentru print A4 |
| Date operator | denumire, CUI, adresă, email și telefon pentru cereri GDPR |
| Persoana de contact | cine răspunde la cereri (nu e obligatoriu un DPO) |
| Unde se tipărește | comutatoare: fișă de lucru, deviz, factură, documente hotel anvelope |
| Link sau QR | adresa notei complete, tipărită ca text sau ca cod QR |

- Livrăm un **text model**, precompletat la crearea contului, marcat vizibil ca
  „model, de validat juridic”.
- Backend: coloane noi pe `general_settings` sau o tabelă `gdpr_settings` per cont,
  endpoint de citire și salvare, migrare Alembic.
- Frontend: panoul de configurare cu previzualizare, plus tipărirea în
  `generateDocuments` — un bloc sub disclaimer, cu font mic, care nu împinge
  restul paginii.
- Fișa de lucru primește în plus un rând scurt lângă semnătura clientului:
  „Am primit informarea privind prelucrarea datelor.”

**Estimare:** 1–2 zile.

### Etapa 2 — Consimțământ pentru marketing

- Pe client: bifă „Accept comunicări comerciale”, cu data, sursa (POS, import,
  online) și cine a bifat-o; istoricul schimbărilor se păstrează.
- Bifa apare în formularul de client și în fișa clientului.
- Orice trimitere viitoare de SMS sau email de marketing filtrează după bifă.
- Retragerea se poate face dintr-un singur loc și e instantanee.

**Estimare:** 1 zi, plus ce ține de canalul de trimitere.

### Etapa 3 — Drepturile clientului

- **Export**: un buton în fișa clientului care scoate tot ce știm despre el
  (date, vehicule, devize, cazări) în PDF și JSON.
- **Ștergere sau anonimizare**: numele, telefonul și adresa se înlocuiesc, dar
  documentele contabile rămân, cu termenele lor legale. Se marchează în fișă că
  datele au fost anonimizate la cerere.
- **Registrul cererilor**: cine a cerut, ce, când, ce s-a răspuns.

**Estimare:** 2–3 zile.

### Etapa 4 — Păstrare și curățare automată

- Termene configurabile per cont, cu implicituri sigure.
- Job de noapte care anonimizează clienții fără activitate peste termen și fără
  documente în perioada legală.
- Raport lunar: ce s-a anonimizat.

**Estimare:** 2 zile.

### Etapa 5 — Documentele pe care clientul le cere la control

- **Registrul activităților de prelucrare**, generat din aplicație pe baza a ce
  prelucrăm efectiv, exportabil.
- **Contractul de împuternicire** între BerlinStar și fiecare cont, acceptat la
  prima autentificare, cu versiune și dată.
- Model de **notă de informare pentru angajați** și model de **informare pentru
  camerele video**.

**Estimare:** 2 zile, plus revizuire juridică.

### Etapa 6 — Securitate și urme

- Jurnal de acces la datele clienților: cine a căutat, cine a exportat.
- Notificarea breșelor: procedură scrisă, cu cine anunță și în cât timp.

## 4. Ce trebuie rezolvat înainte de toate

Repo-ul de pe GitHub e **public** și conține dump-uri ale bazei de producție, cu
datele clienților reali. Din perspectiva GDPR asta e o breșă de securitate, cu
obligație de notificare. Orice muncă pe notele de informare e fără sens cât timp
datele stau public. Pașii: repo privat, curățarea istoricului, oprirea
publicării automate a backup-urilor, evaluarea notificării către ANSPDCP.

## 5. Ce trebuie decis

1. Textul model îl livrăm noi, sau fiecare client îl aduce de la juristul lui?
2. Nota scurtă apare pe toate documentele, sau doar pe fișa de lucru și deviz?
3. Vrem și codul QR către nota completă, sau doar o adresă scrisă?
4. Bifa de marketing intră acum, sau abia când există trimitere de SMS-uri?

## Surse

- [ANSPDCP — informare privind protecția datelor](https://www.dataprotection.ro/?page=Informare_protectia_datelor_conf_GDPR)
- [Articolul 30 GDPR — evidențele activităților de prelucrare](https://www.legeagdpr.ro/titlu-1/capitol-4/sectiune-1/articol-30.html)
- [Registrul de prelucrări: cine e obligat să-l țină](https://uptrust.eu/blog/registru-evidenta-prelucrari-gdpr/)
- [GDPR pentru firme mici — ghid practic](https://isoft-consulting.ro/blog/gdpr-firme-mici-ghid-practic.html)
- [Notă de informare — model și structură](https://www.infocontact.ro/notificare-prelucrare-date-gdpr-model/)
- [ANSPDCP — comunicat despre supravegherea video](https://www.dataprotection.ro/?page=Comunicat_Presa_07.12.2022&lang=ro)
- [Amenzi GDPR pentru camere de supraveghere](https://startupcafe.ro/o-firma-romaneasca-a-primit-o-amenda-gdpr-de-mii-de-euro-pentru-camerele-de-supraveghere-acum-trebuie-sa-le-dea-jos-83029)
- [Protecția datelor în industria auto](https://www.lexology.com/library/detail.aspx?g=6b2b2593-6f1c-4c57-b165-ebba3dad5d68)
