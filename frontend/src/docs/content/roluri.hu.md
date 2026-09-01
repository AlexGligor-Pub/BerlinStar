# Szerepkörök és jogosultságok

Minden felhasználónak van egy szerepköre, amely eldönti, mit láthat és mit tehet. A jogosultságokat a szerver minden művelet során ellenőrzi.

> **Cine schimbă rolurile:** csak **Administrator**, az **Utilizatori** menüből.

## A három szerepkör

| Terület | Administrator | Manager | Lucrător |
| --- | :---: | :---: | :---: |
| Operatív (POS, Recepție, Clienți, Programări, Hotel, Concedii) | ✔ | ✔ | ✔ |
| Haladó (Stocuri, e-Factura, Factură Rapidă, dolgozói adatlapok) | ✔ | ✔ | — |
| Configurări | ✔ | ✔ | — |
| Rapoarte | ✔ | — | — |
| Utilizatori | ✔ | — | — |
| Kedvezmények a nyugtán | ✔ | ✔ | — |
| Privilegizált műveletek (törlések, szabadság jóváhagyása, zárolt bon szerkesztése) | ✔ | ✔ | — |

## Röviden
- **Administrator** — teljes hozzáférés; egyedüliként fér hozzá a **Rapoarte** és **Utilizatori** részekhez.
- **Manager** — mindent, kivéve a **Rapoarte** és **Utilizatori** részt. Adhat kedvezményt.
- **Lucrător** — csak a napi operatív területet; nem látja a készleteket vagy a beállításokat, és nem adhat kedvezményt.

> A felület csak elrejti azt, amit nem használhatsz. Még ha meg is jelenne egy gomb, a szerver elutasítja a jogosulatlan műveletet.
