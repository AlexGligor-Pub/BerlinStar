# e-Factura

Legătura cu sistemul SPV al ANAF pentru facturi electronice.

> **Cine are acces:** **Administrator** și **Manager** (zona avansată).

## Facturi primite și trimise
- **Primite** — facturile venite de la furnizori prin SPV.
- **Trimise** — facturile emise de firmă, cu statusul lor la ANAF.

## De reținut
- O factură trimisă cu succes blochează editarea documentului sursă, ca să nu difere de ce s-a raportat.
- Reducerile se transmit ca discount pe linie, cu prețuri unitare pozitive, conform regulilor e-Factura (fără linii negative).
- Erorile de transmitere sunt afișate pe factură, ca să știi ce trebuie corectat.
