# BerlinQA — Claude Code prin Telegram

Bot Telegram (**@BerlinQA_bot**) care leagă un chat de pe telefon la CLI-ul
`claude` care rulează pe acest server. Un mesaj în Telegram = un prompt tastat
în terminal: agentul citește fișiere, rulează comenzi, editează cod și face
deploy, iar activitatea lui apare live într-un mesaj „Lucrez…".

```
Tu:  de ce e down radar-ul?
Bot: ⚙️ Lucrez… 12s
     $ docker ps -a | grep radar
     📖 deploy/docker-compose.yml
     ✅ 34s · 4 unelte · $0.18

     Containerul deploy-radar-1 a ieșit cu cod 1 acum 20 min...
```

## Cum funcționează
- Long-polling pe `getUpdates` — fără webhook, fără URL public.
- Fiecare mesaj rulează `claude -p --output-format stream-json` în directorul de
  lucru al chatului; `session_id` se salvează, deci contextul se păstrează între
  mesaje exact ca într-o sesiune de terminal.
- Evenimentele de tool (Bash/Read/Edit/Grep/…) sunt afișate live, apoi mesajul de
  progres devine un sumar: durată · număr de unelte · cost.
- Răspunsul (markdown) e convertit în HTML-ul acceptat de Telegram și spart în
  bucăți sub limita de 4096 de caractere, fără să rupă blocurile de cod.

## Permisiuni — atenție
Rulează cu `PERMISSION_MODE=bypassPermissions`: agentul **nu cere confirmare**
pentru nimic, inclusiv scriere de fișiere și comenzi shell, pe serverul de
producție. De asta botul e privat:

- `ALLOWED_USER_IDS` gol ⇒ **primul** user care îi scrie devine proprietar
  (salvat în `state.json`), toți ceilalți sunt respinși.
- Recomandat: după `/id`, pune ID-ul numeric în `.env` ca `ALLOWED_USER_IDS=...`
  și repornește — devine fix, nu mai depinde de „primul venit".

Ca să-l faci mai blând: `PERMISSION_MODE=acceptEdits` (editează, dar cere voie
la comenzi) sau `plan` (doar analizează).

## Comenzi
| Comandă | Ce face |
|---|---|
| `/new` | chat nou — uită tot contextul (sesiune Claude nouă) |
| `/stop` | omoară rularea curentă |
| `/status` | model, effort, folder, sesiune, cost, coadă, uptime |
| `/cd <folder>` | schimbă directorul de lucru (pornește și sesiune nouă) |
| `/model <opus\|sonnet\|haiku\|fable>` | schimbă modelul |
| `/effort <low…max>` | cât de adânc gândește |
| `/sh <comandă>` | shell direct, fără agent — rapid pentru `docker ps`, `git log` |
| `/cost` | costul sesiunii curente |
| `/ping` | uptime bot + uptime server |
| `/id` | ID-ul tău Telegram |
| `/help` | lista de comenzi |

Mesajele primite cât timp agentul lucrează intră într-o coadă per chat și se
execută în ordine.

## Anunț la pornire
La fiecare start, botul trimite un mesaj tuturor chat-urilor cunoscute:
- `🟢 Sunt online` — repornire normală a serviciului;
- `🔄 Serverul tocmai a repornit` — dacă uptime-ul mașinii e sub 5 minute.

Mesajele primite cât timp botul era oprit (mai vechi de 1 minut față de start)
sunt ignorate, ca să nu execute la boot comenzi vechi.

## Configurare (`.env`, git-ignored)
| Cheie | Implicit | Ce face |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | de la @BotFather |
| `ANTHROPIC_API_KEY` | — | folosită de CLI-ul claude |
| `WORKDIR` | `/home/berlinqa/berlinstar` | folderul implicit |
| `CLAUDE_MODEL` | `opus` | model implicit |
| `PERMISSION_MODE` | `bypassPermissions` | vezi mai sus |
| `RUN_TIMEOUT` | `1800` | secunde max per prompt |
| `SH_TIMEOUT` | `120` | secunde max pentru `/sh` |
| `ALLOWED_USER_IDS` | gol | listă de ID-uri, separate prin virgulă |
| `TZ_NAME` | `Europe/Bucharest` | fus orar pentru anunțuri |

Starea (proprietari, sesiuni, cwd, cost, offset) stă în `state.json`.

## Serviciu
Rulează ca serviciu **systemd de user** (`Linger=yes` e activ, deci pornește la
boot fără root):

```bash
systemctl --user status berlinqa-bot      # stare
systemctl --user restart berlinqa-bot     # după modificări de cod/.env
journalctl --user -u berlinqa-bot -f      # loguri live
```

Unit: `~/.config/systemd/user/berlinqa-bot.service`.
Rulare manuală pentru debug: `python3 bot.py`.

## Limitări
- Doar text (fără poze, voce, documente).
- Un singur prompt odată per chat; restul așteaptă la coadă.
- Botul de loguri (`telegram-claude-bot`, @BerlinStarProd_bot) e separat și
  independent de ăsta.
