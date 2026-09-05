# Radar AI — metodologia analizei și cum scrii un Focus bun

## Cum lucrează Radar AI

Radar AI face, în fiecare rulare, patru pași:

1. **Colectare.** Pentru fiecare sursă activă (canal YouTube, CUI de concurent, site, profil Google Business)
   se descarcă doar elementele noi: videoclipuri noi, bilanțuri noi, pagina de azi, recenziile de azi.
   Un element deja analizat nu se re-analizează și nu se re-facturează.
2. **Digest per element.** Fiecare element este citit separat de AI și transformat într-o fișă structurată
   (rezumat, cifre, noutăți, teme din recenzii). Aici se face doar *observația*, cu date din sursă.
3. **Sinteză.** Toate fișele din perioadă, plus raportul precedent, intră într-o singură analiză care produce
   raportul: semnale, recomandări, cadrul de decizie, ce s-a schimbat față de data trecută, ce lipsește.
4. **Raport + PDF.** Raportul rămâne în istoric și se poate exporta.

## Principiile pe care se bazează raportul

- **Doar afirmații cu dovadă.** Fiecare semnal și fiecare recomandare trimit la elementele din care au ieșit
  (`snapshot_id`). AI-ul nu are voie să inventeze cifre; ce nu știe scrie „necunoscut” și trece la *Lipsuri de date*.
- **Observație separată de interpretare.** Întâi ce s-a văzut, apoi ce crede analistul, marcat cu „probabil”, „sugerează”.
- **Un semnal nu e tendință.** Ce apare o singură dată e ipoteză; ce se repetă în mai multe surse devine semnal.
- **Cinci lentile de piață:** mișcările concurenței, semnalele de preț, semnalele de cerere, adopția de tehnologie,
  vocea clientului (recenzii).
- **Decizie, nu doar informație.** Raportul se termină cu opțiuni reale (inclusiv „nu facem nimic acum”), pro și contra,
  prioritate 1-5, orizont (acum / 30 de zile / trimestru), încredere, riscuri de tip pre-mortem („dacă peste 3 luni
  a ieșit prost, de ce?”) și, explicit, ce informație nouă ar schimba recomandarea.
- **De copiat vs de evitat.** Din recenziile și site-urile concurenței se extrag comportamentele care aduc clienți
  și greșelile de evitat.
- **La scara unei firme mici.** Recomandările presupun buget mic și câțiva oameni, nu proiecte de corporație.

## Ce citește raportul

| Secțiune | Ce găsești |
|---|---|
| Sumar executiv | Maximum 10 rânduri: ce s-a întâmplat, ce înseamnă, ce urmează. |
| Semnale cheie | Ce s-a schimbat pe piață, cu impact (mare/mediu/mic) și dacă e oportunitate sau amenințare. |
| Recomandări | Acțiuni concrete, ordonate după prioritate, cu termen și nivel de încredere. |
| Cadrul de decizie | Decizia principală a perioadei, cu opțiuni, argumente și riscuri. |
| Secțiuni pe surse | Fișele detaliate: videoclipuri, firme concurente, noutăți de pe site-uri, recenzii. |
| Ce s-a schimbat | Diferențele față de raportul precedent. |
| Lipsuri de date | Ce nu s-a putut verifica (surse fără date, eșantioane mici). |

## Cum scrii un Focus bun

Focus-ul este textul care spune AI-ului **ce decizie te frământă**. Fără el, analiza rămâne generală.

Un Focus bun conține: cine ești și unde, ce vrei să decizi, ce te interesează în mod special și ce nu, plus
constrângerile tale (buget, spațiu, oameni, sezon).

Reguli practice:
- Scrie o decizie, nu o temă. „Merită să investesc în X?” bate „vreau să știu despre X”.
- Spune constrângerile reale: cât poți investi, cât spațiu ai, câți oameni.
- Spune și ce **nu** te interesează, ca să nu se umple raportul cu zgomot.
- Menționează sezonul și zona: piața de anvelope din octombrie nu seamănă cu cea din mai.
- Actualizează Focus-ul când se schimbă întrebarea. Raportul următor se va compara cu cel precedent.

### Exemplu 1 — Vulcanizare

> Vulcanizare cu 2 posturi în Timișoara, zonă rezidențială, 3 angajați. Vreau să decid dacă investesc în
> hotel de anvelope (spațiu închiriat, aprox. 15.000 €) înainte de sezonul de iarnă. Mă interesează: ce
> prețuri afișează concurenții din oraș la depozitare și la schimbul de anvelope, dacă apar utilaje noi
> pentru jante mari și de ce se plâng clienții altor vulcanizări în recenzii. Nu mă interesează tuningul
> și cursurile plătite. Constrângeri: nu pot angaja încă o persoană până în primăvară.

### Exemplu 2 — Service auto

> Service auto multimarcă în Arad, 5 elevatoare, 8 mecanici. Decizia: intru pe partea de electrice și
> hibride (aparatură + curs de certificare, aprox. 20.000 €) sau întăresc partea clasică de mecanică?
> Urmăresc: ce servicii noi anunță service-urile concurente, ce echipamente de diagnoză apar, semnalele
> de preț la manoperă și ce reclamații primesc concurenții pe termene de execuție. Nu mă interesează
> vânzarea de mașini. Constrângere: un singur mecanic poate fi trimis la cursuri.

### Exemplu 3 — Magazin de piese

> Magazin de piese auto în Oradea, vânzare la tejghea și livrare către 4 service-uri partenere.
> Vreau să decid ce fac cu stocul înainte de iarnă și dacă merită să deschid vânzare online.
> Mă interesează: ce game de preț practică distribuitorii și magazinele concurente, ce mărci noi apar,
> dacă cresc termenele de livrare la furnizori și ce reclamă clienții la magazinele online de piese.
> Nu mă interesează piesele pentru camioane. Constrângere: buget de stoc suplimentar sub 10.000 €.

## Descoperire concurenți

Tabul „Concurenți" caută firmele din jurul tău și le trece prin aceleași reguli de dovadă ca raportul Radar.

**Cum funcționează.** Alegi firma din cont, iar AI-ul îți precompletează șase întrebări (zonă, rază, servicii,
termeni de căutare, concurenți cunoscuți, excluderi). Cu termenii tăi se caută pe Google Maps în cercul de rază
aleasă, se elimină duplicatele și firma ta, apoi pentru fiecare concurent se citește site-ul public (titlu, text,
linkuri YouTube și Facebook, CUI confirmat la ANAF). Se păstrează maximum 15 firme, ordonate după notă, recenzii
și distanță, iar un singur apel AI le evaluează pe toate. Rezultatul se importă ca surse Radar sau devine Focus.

**Cum răspunzi bine la întrebări.** Termenii de căutare contează cel mai mult: scrie ce ar tasta un client
(„vulcanizare", „hotel anvelope", „schimb ulei"), nu nume de firme. Raza o pui cât de departe vin clienții:
10-15 km în oraș, 25-40 km în zonă rurală. La servicii enumeră doar ce vinzi efectiv, altfel apar comparații
nerelevante. La excluderi spune explicit ce nu te interesează (francize naționale, magazine online, alt domeniu);
firmele excluse rămân în listă, dar cu relevanță mică.

**Cum citești rezultatul.** *Amenințarea* spune cât de mult îți ia clienți acum: `mare` = același serviciu,
aproape, bine cotat; `medie` = suprapunere parțială sau mai departe; `mică` = alt profil sau prezență slabă.
*Relevanța* (0-100) spune cât merită urmărit lunar în Radar: peste 80 e concurent direct, 40-60 secundar, sub 20
înseamnă că iese din profilul tău. Fiecare evaluare are dovezi luate din datele găsite; ce nu s-a putut verifica
apare la *Lipsuri de date* — o notă mare din 5 recenzii nu e o dovadă de calitate.
