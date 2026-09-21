# BerlinStar log agent (Telegram)

A Telegram bot (**@BerlinStarProd_bot**) that acts as a log-monitoring agent.
Every message triggers a real log check with Claude, which then replies with a
short report formatted for a phone screen. Routine checks (chat + scheduled
reports) run on the cheapest model, **Haiku 4.5** (`CLAUDE_MODEL`; Haiku takes no
`effort`). `/adminask`, `/investigate` and Opus mode run on **Opus 4.8**
(`ADMIN_MODEL`, `ADMIN_EFFORT=high`). Every reply ends with the model that
produced it.

```
🩺 Log check · 07:30
Status: ⚠️ Warnings

• deploy-db-1: 5× FATAL password auth failed (07:01–07:24)
• backend: 403 on GET /api/subscription/me at 07:29
• 7 containers up; db checkpoints normal

Next: fix the app using DB user root — repeating auth failures.
```

Bold title + status emoji + short bullets, no tables or wide code blocks
(which force horizontal scrolling on mobile). Kept under ~900 chars.

## How it works
- Long-polls Telegram (`getUpdates`) — no public URL / webhook needed.
- Keeps a short per-chat history so follow-ups have context.
- Answers through the Claude Agent SDK (the `claude` CLI bundled in the SDK), so
  it runs on the **Claude subscription** login (`~/.claude/.credentials.json`)
  by default. Set `USE_API_KEY=1` to bill `ANTHROPIC_API_KEY` instead.
- Built-in Claude Code tools (Bash/Read/Edit…) are disabled — the model only
  gets the log tools below, served as an in-process MCP server.
- Can inspect the server's logs via read-only tools (see below).

## Log tools (read-only)
Defined in `logtools.py` and given to Claude as tools. Just ask in plain
language ("any errors in the backend container in the last hour?").

| Tool | What it reads |
|------|---------------|
| `query_journal` | systemd journal (`journalctl`) — filter by unit/since/priority/grep |
| `list_containers` / `container_logs` | running Docker containers' logs |
| `list_log_files` / `read_log_file` | files under `/var/log` and the app/bot logs |

Safety: all tools are read-only; subprocess calls use argument lists (no shell);
file reads are restricted to allow-listed dirs (`/var/log`, `backend/logs`,
`telegram-claude-bot`) and, outside `/var/log`, to `*.log*` files only — so
`.env`, configs, and DB backups can't be read. Output is capped per call.

## Setup
Secrets live in `.env` (git-ignored):
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `USE_API_KEY` — `0` (default) = Claude subscription via the CLI login
  (run `claude` → `/login` once as the service user); `1` = use `ANTHROPIC_API_KEY`.
  With `0`, any `ANTHROPIC_API_KEY` in the environment is ignored.
- `ANTHROPIC_API_KEY` — only with `USE_API_KEY=1`
- `CLAUDE_MODEL`, `CLAUDE_SYSTEM_PROMPT` — optional overrides
- `ALLOWED_USER_IDS` — optional comma-separated allow-list (blank = everyone)

Dependencies are installed in `.venv/` from `requirements.txt`
(`mcp<2` is pinned — the SDK's in-process MCP server breaks on mcp 2.x).

Each Telegram bot token can only be polled from one server: QA must use a
different bot than prod (@BerlinStarProd_bot), or both get `409 Conflict`.

### QA server (user berlinqa, no root)
Runs as a **systemd user service**:
`~/.config/systemd/user/berlinstar-logbot.service`
```bash
systemctl --user enable --now berlinstar-logbot
journalctl --user -u berlinstar-logbot -f
```

## Run (systemd service)
Installed as `berlinstar-logbot.service` (auto-starts on boot, restarts on crash):
```bash
systemctl status berlinstar-logbot        # state
systemctl restart berlinstar-logbot       # after code/.env changes
journalctl -u berlinstar-logbot -f        # live logs
```
Unit file: `/etc/systemd/system/berlinstar-logbot.service`.
Secrets/config are read from `.env` (the daemon has no shell env).

Manual run (for debugging): `./.venv/bin/python bot.py`

## Scheduled reports
The agent pushes an automatic report on a schedule to every subscriber.
- Default: **every 2h, 08:00–20:00 Europe/Bucharest** (7 reports/day).
- Configure in `.env`: `REPORT_HOURS=8,10,12,14,16,18,20` and `REPORT_TZ=Europe/Bucharest`.
- **Subscribe by sending `/start`** (or `/subscribe`) to the bot. `/unsubscribe` to stop.
- Subscribers persist in `subscribers.json`.

## Chat commands
All commands are registered with Telegram (`setMyCommands`) at startup, so they
show up under the chat's **Menu** button.
- `/start` — intro + subscribe to auto-reports
- `/report` — run a report right now (Haiku)
- `/adminask <question>` — answer one question on Opus 4.8 (keeps chat context)
- `/adminask` (no text) — Opus mode: every message goes to Opus 4.8 for
  `OPUS_MODE_MINUTES` (default 30), then falls back automatically
- `/normal` — leave Opus mode, back to Haiku
- `/investigate <topic>` — deep root-cause dive on Opus 4.8
- `/subscribe` / `/unsubscribe` — toggle auto-reports
- `/status` — current model, schedule, next run, subscriber count
- `/reset` — clear the conversation (also exits Opus mode)
- `/login` — get a fresh Claude subscription login link
- `/help` — usage

## Auto-update din MainProd (`updater.py`)
La fiecare `UPDATE_CHECK_MINUTES` (implicit 15) botul face `git fetch`; dacă
`origin/MainProd` are commit-uri noi:
1. `git pull` (ff sau merge; la conflict anulează și anunță)
2. backup DB: `deploy/backup_Productie_<ts>.sqlplus` + `/root/db_backups/auto_update_<ts>.dump`
   (format custom, pentru restore; se păstrează ultimele `UPDATE_KEEP_DUMPS`=10)
3. din `deploy/`: `git add .`, `git commit -m "backup <zi> <lună> (auto-update <sha>)"`,
   `git push` cu `GIT_PUSH_TOKEN`
4. agent **Opus 5** (`UPDATE_MODEL`), **auto mode** (`UPDATE_PERMISSION_MODE`), cu
   tool-urile Claude Code read/write: citește instrucțiunile (commit-uri, `.md`,
   `.env.example`), face `docker compose build --no-cache && up -d`, verifică alembic,
   loguri, health. N-are voie la git push/reset/checkout, `down -v`, ștergere volume,
   repornirea botului.
5. verificări proprii: containere running/healthy, alembic la head, HTTP 200 pe
   `UPDATE_HEALTH_URLS`

Dacă pașii 1–3 eșuează, codul revine imediat (aplicația n-a fost atinsă). Dacă
update-ul eșuează, botul trimite situația abonaților (+ `UPDATE_NOTIFY_CHAT_IDS`) și
cere sfat: orice mesaj text de la un admin ajunge la agent (aceeași sesiune).
`/rollback` sau `UPDATE_ADVICE_TIMEOUT_MIN` (60) fără răspuns → rollback: cod la
commit-ul inițial, `deploy/.env` restaurat, DB restaurat **doar dacă alembic s-a
schimbat** (DB-ul migrat rămâne ca `berlinstar_failed_<ts>`), rebuild, verificări.
Commit-ul eșuat nu se reîncearcă până nu apare altul nou (`/update force` = acum).
Dacă s-a schimbat codul botului, botul se repornește singur la final.

Starea e în `update_state.json` (o repornire a botului reia așteptarea sfatului).
Comenzi (admini): `/update`, `/update force`, `/updatestatus`, `/rollback`.
Repo-ul trebuie să fie pe `MainProd` fără modificări necomise, altfel updater-ul doar anunță.

## Access
Only users in `ALLOWED_USER_IDS` or `ALLOWED_USERNAMES` may use the bot (if both
are empty it answers anyone and logs a warning). The Opus commands are limited
to `ADMIN_USER_IDS` / `ADMIN_USERNAMES`, which default to the allow-lists.

If a run fails because the subscription login is missing/expired, the bot
starts `claude auth login` and sends the authorize URL to the chat (scheduled
reports send it to all subscribers). Open it, authorize, and send the bot the
code shown at the end. The login is shared with `telegram-code-bot` via
`~/.claude`. Code: `../telegram-common/claude_login.py`. Since anyone allowed
to use the bot can complete the login, set `ALLOWED_USER_IDS`.

## Notes
- Text messages only (no images/voice yet).
- Long replies are split to fit Telegram's 4096-char limit.
- To lock the bot to just you: find your numeric ID (message @userinfobot),
  put it in `ALLOWED_USER_IDS`, and restart.
