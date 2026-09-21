# Configurări și abonament

Centrul de administrare al firmei: organizație, nomenclatoare, sistem și cont. Este împărțit în patru grupuri în bara laterală.

> **Cine are acces:** **Administrator** și **Manager** intră în **Configurări**. Zonele marcate mai jos „doar Administrator" sunt ascunse Managerului.

## Organizație

Structura firmei tale.

- **Companiile mele** — datele firmei (nume, CUI, adresă, cont bancar). Pot fi preluate automat din **ANAF** după CUI. Apar pe devize și facturi.
- **Locații** — punctele de lucru / atelierele. Fiecare stație și fiecare programare aparțin unei locații.
- **Departamente** — grupele de activitate (ex. vulcanizare, mecanică). Structurează produsele/serviciile și rapoartele.
- **Angajați** — fișele colegilor: date de contact, date legale (zile de concediu), departament, locație. Un utilizator poate fi legat de o fișă de angajat, iar vânzările atribuite unui angajat alimentează targetul lui.

Peste tot folosești **+ Adaugă** pentru o intrare nouă și căutarea de sus pentru a filtra.

## Operațiuni

Nomenclatoarele folosite zilnic.

- **Produse și Servicii** — catalogul din care adaugi articole pe deviz: preț, TVA, departament, categorie și, pentru produse, stoc. Un **produs** scade din stoc la vânzare; un **serviciu** nu.
- **Disclaimers** — textele standard (condiții, avertismente) care apar pe documente.
- **Registre** — seriile și numerotarea documentelor (devize, facturi, chitanțe).

## Sistem

- **Setări generale** — preferințe de comportament ale aplicației, fiecare cu explicația ei lângă comutator.
- **Dispozitivul meu** — înregistrarea stației (POS) și locația ei. Setare a stației, nu a utilizatorului: rămâne și după logout.
- **eFactura ANAF** — conectarea firmei la SPV (autorizare) pentru trimiterea și primirea facturilor electronice.

## Import

Importuri în masă din fișiere. Fișierul se ia întreg, dintr-o bucată. Pașii sunt aceiași la ambele: alegi fișierul → sistemul îl **verifică** (nu salvează nimic) → pornești importul, care rulează **în fundal**, cu bară de progres (poți părăsi pagina) → rândurile cu probleme rămân într-o **listă de rezolvat**.

În listă rezolvi un rând (completezi, alegi clientul, confirmi) sau îl respingi; poți selecta mai multe rânduri deodată, iar un rând respins poate fi readus. **Istoric importuri** păstrează toate sesiunile, iar din fiecare sesiune poți descărca **raportul importului (CSV)**: fiecare rând din fișier, cu ce s-a întâmplat cu el și de ce. Cât timp există rânduri nerezolvate, lângă intrarea din meniu apare un număr, iar sesiunea e marcată **Necesită acțiuni**.

- **Clienți** (doar **Administratorul** contului) — fișier **CSV**. Descarcă **modelul CSV** și completează-l (în Excel: „Salvare ca → CSV"). Primul rând e antetul; singura coloană obligatorie este **nume**. Dacă **tip** (fizic / juridic) lipsește, clientul e considerat persoană fizică. La **telefon** pot fi mai multe numere despărțite prin virgulă — dacă fișierul folosește virgula și între coloane, pune câmpul între ghilimele.
  - Categorii de rezolvat: **date lipsă**, **date invalide**, **posibil duplicat**.
  - O valoare necunoscută se lasă goală sau se scrie `#LIPSA`, `-` ori `N/A`. Dacă imporți un rând cu o valoare obligatorie lipsă, sistemul pune un marcaj (ex. numele `NECOMPLETAT (rând N)`) și adaugă în **Observații** eticheta `[Import CSV] Date lipsă: …`.
- **Hotel anvelope** (**Administrator** și **Manager**) — fișier **Excel (.xlsx)** sau CSV. Fiecare linie e o anvelopă; liniile cu aceeași mașină și aceeași dată formează o cazare (numele clientului poate fi scris doar pe prima linie). Coloanele obligatorii: **Nr. mașină** și **Depozitate** (data). Foile ascunse din registru sunt ignorate. Cazările intră pe un **punct de lucru** — cel al stației de la care faci importul; dacă firma are mai multe, îl alegi înainte de import. Acolo se vor vedea apoi în pagina Hotel anvelope.
  - Clientul se caută **după numărul de mașină**, apoi **după nume și prenume**. Numărul găsit la un singur client → cazarea se importă direct.
  - Categorii de rezolvat: **Potrivit după nume** (confirmi), **Client ambiguu** (alegi dintre clienții propuși sau cauți altul), **Client nou** (se creează clientul), **Posibil duplicat** și **Date invalide**. *Client nou* și *Potrivit după nume* se pot importa toate odată.
  - Locul din depozit devine loc de cazare; dimensiunea, profilul și DOT-ul se adaugă în nomenclatoare. O **marcă nouă** se propune spre aprobarea platformei și se pune pe anvelope — în listele de mărci apare după aprobare.
- **Anularea unui import (revert)** — butonul **Anulează importul (revert)** din sesiune, disponibil după ce importul s-a terminat. Îți arată întâi ce se șterge și ce se păstrează, apoi confirmi. Se șterge ce a creat importul (clienți noi, cazări, anvelope, mașini adăugate în garaj, valori noi din nomenclatoare), dar se păstrează ce a fost folosit sau modificat între timp: o cazare scoasă din depozit, legată de un deviz sau editată, o anvelopă cu măsurători adăugate ulterior, un client care a primit devize.

## Cont

- **Utilizatori** — gestionarea colegilor (creare, roluri, resetare parolă). Vezi secțiunea **Utilizatori**. *Doar Administrator.*
- **Contul Meu** — profilul tău și datele afișate ale firmei. Aici e și **Parola mea**, unde îți schimbi propria parolă (a utilizatorului **logat acum**, nu a firmei). Schimbarea parolei e disponibilă oricărui rol; editarea datelor firmei — doar **Administrator**.
- **Abonament** — planul BerlinStar al firmei și plata lui. *Doar Administrator* vede și poate iniția plăți.

> Tema (**Light**, **Dark**, **Gray**, **Navy**) se schimbă din meniul din colțul de sus, nu de aici — este o preferință a stației.
