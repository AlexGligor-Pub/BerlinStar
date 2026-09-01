# Roluri și permisiuni

Fiecare utilizator are un rol care decide ce poate vedea și face. Permisiunile sunt verificate pe server la fiecare acțiune.

> **Cine schimbă rolurile:** doar **Administrator**, din **Utilizatori**.

## Cele trei roluri

| Zonă | Administrator | Manager | Lucrător |
| --- | :---: | :---: | :---: |
| Operațional (POS, Recepție, Clienți, Programări, Hotel, Concedii) | ✔ | ✔ | ✔ |
| Avansat (Stocuri, e-Factura, Factură Rapidă, fișe angajați) | ✔ | ✔ | — |
| Configurări | ✔ | ✔ | — |
| Rapoarte | ✔ | — | — |
| Utilizatori | ✔ | — | — |
| Reduceri pe bon | ✔ | ✔ | — |
| Acțiuni privilegiate (ștergeri, aprobare concedii, editare bon blocat) | ✔ | ✔ | — |

## Pe scurt
- **Administrator** — acces complet; singurul cu **Rapoarte** și **Utilizatori**.
- **Manager** — tot, mai puțin **Rapoarte** și **Utilizatori**. Poate acorda reduceri.
- **Lucrător** — doar zona operațională de zi cu zi; nu vede stocuri sau setări și nu poate acorda reduceri.

> Interfața doar ascunde ce nu ai voie să folosești. Chiar dacă un buton ar apărea, serverul respinge acțiunea neautorizată.
