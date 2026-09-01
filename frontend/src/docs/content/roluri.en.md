# Roles and permissions

Every user has a role that determines what they can see and do. Permissions are checked on the server for every action.

> **Who changes roles:** only **Administrator**, from **Utilizatori**.

## The three roles

| Zone | Administrator | Manager | Lucrător |
| --- | :---: | :---: | :---: |
| Operational (POS, Recepție, Clienți, Programări, Hotel, Concedii) | ✔ | ✔ | ✔ |
| Advanced (Stocuri, e-Factura, Factură Rapidă, employee records) | ✔ | ✔ | — |
| Configurări | ✔ | ✔ | — |
| Rapoarte | ✔ | — | — |
| Utilizatori | ✔ | — | — |
| Discounts on receipts | ✔ | ✔ | — |
| Privileged actions (deletions, leave approval, editing a locked receipt) | ✔ | ✔ | — |

## In short
- **Administrator** — full access; the only one with **Rapoarte** and **Utilizatori**.
- **Manager** — everything except **Rapoarte** and **Utilizatori**. Can grant discounts.
- **Lucrător** — only the day-to-day operational zone; cannot see stock or settings and cannot grant discounts.

> The interface only hides what you are not allowed to use. Even if a button were to appear, the server rejects the unauthorized action.
