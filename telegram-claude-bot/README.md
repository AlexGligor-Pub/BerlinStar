# BerlinStar log agent (Telegram)

A Telegram bot (**@BerlinStarProd_bot**) that acts as a log-monitoring agent.
Every message triggers a real log check with Claude, which then replies with a
short report formatted for a phone screen. Routine checks run on
**Sonnet 4.6** (`effort=medium`); deep `/investigate` dives run on **Opus 4.8**
(`effort=high`). Both are set in `.env`.

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
- Answers with the Anthropic SDK using adaptive thinking.
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
- `ANTHROPIC_API_KEY` — inherited from the shell if not set in `.env`
- `CLAUDE_MODEL`, `CLAUDE_SYSTEM_PROMPT` — optional overrides
- `ALLOWED_USER_IDS` — optional comma-separated allow-list (blank = everyone)

Dependencies are installed in `.venv/`.

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
- `/start` — intro + subscribe to auto-reports
- `/report` — run a report right now
- `/investigate <topic>` — deep root-cause dive on Opus 4.8
- `/subscribe` / `/unsubscribe` — toggle auto-reports
- `/status` — schedule, next run, subscriber count
- `/reset` — clear the conversation
- `/help` — usage

## Notes
- Text messages only (no images/voice yet).
- Long replies are split to fit Telegram's 4096-char limit.
- To lock the bot to just you: find your numeric ID (message @userinfobot),
  put it in `ALLOWED_USER_IDS`, and restart.
