#!/usr/bin/env python3
"""Telegram <-> Claude bridge.

Long-polls Telegram for messages and answers each one with Claude, keeping a
per-chat Claude session so follow-up questions have context.

Claude runs through the Claude Agent SDK (the `claude` CLI), so it uses the
CLI's Claude subscription login by default; set USE_API_KEY=1 to bill an
ANTHROPIC_API_KEY instead.

Run:  ./.venv/bin/python bot.py
"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import signal
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import claude_agent_sdk
import requests
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    create_sdk_mcp_server,
    query,
    tool,
)

import logtools

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "telegram-common"))
import claude_login  # noqa: E402

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

def load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external dependency). Does not overwrite existing env vars."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv(Path(__file__).with_name(".env"))

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
# Routine log checks (chat + scheduled reports) run on the cheapest model.
MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5").strip()
EFFORT = os.environ.get("CLAUDE_EFFORT", "").strip()
# /adminask, /investigate and Opus mode run on the strong model.
ADMIN_MODEL = os.environ.get("ADMIN_MODEL", os.environ.get("INVESTIGATE_MODEL", "claude-opus-4-8")).strip()
ADMIN_EFFORT = os.environ.get("ADMIN_EFFORT", os.environ.get("INVESTIGATE_EFFORT", "high")).strip()
OPUS_MODE_MINUTES = int(os.environ.get("OPUS_MODE_MINUTES", "30"))  # auto-off for Opus mode
SYSTEM_PROMPT = os.environ.get(
    "CLAUDE_SYSTEM_PROMPT",
    (
        "You are BerlinStar's log-monitoring agent, reachable over Telegram and "
        "read on a phone. You have read-only tools: the systemd journal "
        "(query_journal), Docker container logs (list_containers, container_logs), "
        "and log files under /var/log and the app/bot logs (list_log_files, "
        "read_log_file).\n\n"
        "ON EVERY MESSAGE: actually use the tools to check the relevant logs "
        "before replying — never answer from memory. If the user names a target "
        "(a container, service, file, time window, or error), focus there. "
        "Otherwise do a quick health sweep: recent journal errors and the running "
        "containers.\n\n"
        "Then reply with a SHORT report built for a narrow phone screen. Format "
        "EXACTLY like this:\n"
        "<b>🩺 Log check · HH:MM</b>\n"
        "<b>Status:</b> ✅ Healthy   (or ⚠️ Warnings, or ❌ Errors)\n"
        "\n"
        "• one finding per line, newest/most important first — include the source "
        "(unit/container/file) and a count if relevant\n"
        "• keep each bullet to one short line\n"
        "\n"
        "<b>Next:</b> one short action, or 'Nothing to action.'\n\n"
        "Rules: keep the whole message under ~900 characters. No tables. No wide "
        "or multi-line code blocks (they force horizontal scrolling on phones). "
        "Quote at most ONE short log snippet inline with <code>…</code>. Use only "
        "the tags <b>, <i>, <code>. Use '• ' for bullets. Be specific — cite real "
        "counts and timestamps you saw in the tool output."
    ),
).strip()
MAX_TOOL_ITERS = 8  # safety cap on the tool-use loop per message
ALLOWED_USER_IDS = {
    uid.strip() for uid in os.environ.get("ALLOWED_USER_IDS", "").split(",") if uid.strip()
}
ALLOWED_USERNAMES = {
    u.strip().lstrip("@").lower()
    for u in os.environ.get("ALLOWED_USERNAMES", "").split(",") if u.strip()
}
# Who may use the Opus commands; defaults to the allow-lists above.
ADMIN_USER_IDS = {
    u.strip() for u in os.environ.get("ADMIN_USER_IDS", "").split(",") if u.strip()
} or ALLOWED_USER_IDS
ADMIN_USERNAMES = {
    u.strip().lstrip("@").lower()
    for u in os.environ.get("ADMIN_USERNAMES", "").split(",") if u.strip()
} or ALLOWED_USERNAMES

TELEGRAM_MSG_LIMIT = 4096  # Telegram hard limit per message

# --- Scheduled reports ---
REPORT_TZ = os.environ.get("REPORT_TZ", "Europe/Bucharest").strip()


def _parse_hours(s: str) -> list[int]:
    hrs = {int(t) % 24 for t in s.split(",") if t.strip().isdigit()}
    return sorted(hrs) or [8, 10, 12, 14, 16, 18, 20]


REPORT_HOURS = _parse_hours(os.environ.get("REPORT_HOURS", "8,10,12,14,16,18,20"))
try:
    TZ = ZoneInfo(REPORT_TZ)
except Exception:
    TZ, REPORT_TZ = ZoneInfo("UTC"), "UTC (fallback)"

SUBSCRIBERS_FILE = Path(__file__).with_name("subscribers.json")
SCHEDULED_PROMPT = (
    "Scheduled health check. Do a full sweep: journal errors/warnings from the "
    "last 2 hours and the state of all running containers. Reply in the standard "
    "short report format."
)

if not TELEGRAM_BOT_TOKEN:
    sys.exit("TELEGRAM_BOT_TOKEN is not set (put it in .env or the environment).")
# Subscription (CLI OAuth login) by default; the API key only when explicitly opted in.
USE_API_KEY = os.environ.get("USE_API_KEY", "0").strip().lower() in {"1", "true", "yes"}
if USE_API_KEY:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("USE_API_KEY=1 but ANTHROPIC_API_KEY is not set.")
else:
    # An API key in the env overrides the subscription login in the CLI — drop it.
    # Without a login the bot still starts: the first failed run sends the
    # login link over Telegram (see telegram-common/claude_login.py).
    for _var in claude_login.API_KEY_VARS:
        os.environ.pop(_var, None)

API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("tg-claude")

sessions: dict[int, str] = {}  # chat_id -> Claude session id (conversation context)
opus_mode: dict[int, float] = {}  # chat_id -> monotonic deadline while Opus mode is on
_running = True


def load_subscribers() -> set[int]:
    try:
        return {int(x) for x in json.loads(SUBSCRIBERS_FILE.read_text())}
    except Exception:
        return set()


def save_subscribers() -> None:
    try:
        SUBSCRIBERS_FILE.write_text(json.dumps(sorted(subscribers)))
    except Exception:
        log.exception("Could not save subscribers")


subscribers: set[int] = load_subscribers()

# --------------------------------------------------------------------------- #
# Telegram helpers
# --------------------------------------------------------------------------- #

def tg(method: str, **params):
    """Call a Telegram Bot API method; return the `result` payload or None."""
    try:
        resp = requests.post(f"{API}/{method}", json=params, timeout=65)
        data = resp.json()
        if not data.get("ok"):
            log.warning("Telegram %s failed: %s", method, data.get("description"))
            return None
        return data.get("result")
    except requests.RequestException as e:
        log.warning("Telegram %s network error: %s", method, e)
        return None


_ALLOWED_TAGS = ("b", "i", "u", "s", "code", "pre", "blockquote")


def telegram_html(text: str) -> str:
    """Render model output as Telegram-safe HTML.

    Escapes everything (so stray < > & in log snippets can't break parsing),
    then re-enables a small whitelist of tags the model is told to use, plus a
    markdown fallback for **bold** / `code` in case it slips into markdown.
    """
    esc = html.escape(text, quote=False)
    for tag in _ALLOWED_TAGS:
        esc = esc.replace(f"&lt;{tag}&gt;", f"<{tag}>")
        esc = esc.replace(f"&lt;/{tag}&gt;", f"</{tag}>")
    esc = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", esc, flags=re.S)
    esc = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", esc)
    return esc


def send_message(chat_id: int, text: str) -> None:
    """Send text, chunking to respect Telegram's 4096-char limit."""
    for chunk in split_text(text, TELEGRAM_MSG_LIMIT):
        # Try HTML formatting first; fall back to tag-stripped plain text.
        if tg("sendMessage", chat_id=chat_id, text=chunk, parse_mode="HTML",
              disable_web_page_preview=True) is None:
            plain = re.sub(r"<[^>]+>", "", chunk)
            tg("sendMessage", chat_id=chat_id, text=plain, disable_web_page_preview=True)


def split_text(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks, current = [], ""
    for line in text.split("\n"):
        while len(line) > limit:  # a single very long line
            chunks.append(line[:limit])
            line = line[limit:]
        if len(current) + len(line) + 1 > limit:
            chunks.append(current)
            current = line
        else:
            current = f"{current}\n{line}" if current else line
    if current:
        chunks.append(current)
    return chunks


def send_typing(chat_id: int) -> None:
    tg("sendChatAction", chat_id=chat_id, action="typing")


# --------------------------------------------------------------------------- #
# Claude
# --------------------------------------------------------------------------- #

MCP_SERVER = "logs"
# The CLI the SDK runs (bundled in the wheel) also performs the re-login.
CLAUDE_BIN = str(Path(claude_agent_sdk.__file__).parent / "_bundled/claude")


class ClaudeAuthError(RuntimeError):
    """The subscription login is missing or expired."""


LOGIN = claude_login.LoginFlow(CLAUDE_BIN, send_message)


def _make_tool(spec: dict):
    """Wrap a logtools tool as an in-process MCP tool for the Agent SDK."""
    name = spec["name"]

    async def handler(args: dict) -> dict:
        log.info("tool_use %s %s", name, args)
        # Tools shell out (journalctl/docker) — keep them off the event loop.
        output = await asyncio.to_thread(logtools.run_tool, name, args)
        return {"content": [{"type": "text", "text": output}]}

    return tool(name, spec["description"], spec["input_schema"])(handler)


def _effort_for(model: str, effort: str) -> str | None:
    # Haiku 4.5 rejects the effort parameter — leave it unset there.
    return None if not effort or "haiku" in model else effort


def short_model(model: str) -> str:
    """claude-opus-4-8 -> Opus 4.8 (for reply footers and /status)."""
    m = re.match(r"claude-([a-z]+)-(\d+)(?:-(\d+))?", model)
    if not m:
        return model
    return f"{m[1].capitalize()} {m[2]}" + (f".{m[3]}" if m[3] else "")


def _options(model: str, effort: str, resume: str | None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=model,
        effort=_effort_for(model, effort),
        system_prompt=SYSTEM_PROMPT,
        tools=[],  # no built-in Claude Code tools (Bash/Read/Edit…) — logs only
        mcp_servers={MCP_SERVER: create_sdk_mcp_server(
            MCP_SERVER, tools=[_make_tool(t) for t in logtools.TOOLS])},
        strict_mcp_config=True,
        allowed_tools=[f"mcp__{MCP_SERVER}__{t['name']}" for t in logtools.TOOLS],
        permission_mode="dontAsk",
        max_turns=MAX_TOOL_ITERS,
        cwd=str(Path(__file__).resolve().parent),
        resume=resume,
    )


async def _run_agent_async(prompt: str, model: str, effort: str,
                           resume: str | None) -> tuple[str, str | None]:
    texts: list[str] = []
    session_id = resume
    error = None
    async for message in query(prompt=prompt, options=_options(model, effort, resume)):
        if isinstance(message, AssistantMessage):
            error = message.error or error
            parts = [b.text for b in message.content if isinstance(b, TextBlock)]
            if parts:
                texts = parts  # keep only the last assistant text (the final reply)
        elif isinstance(message, ResultMessage):
            session_id = message.session_id or session_id
            if message.subtype == "error_max_turns":
                return "⚠️ Stopped after too many tool calls. Try narrowing the request.", session_id
            if message.is_error:
                if not USE_API_KEY and claude_login.is_auth_error(error, message.result):
                    raise ClaudeAuthError(message.result or error)
                raise RuntimeError(message.result or message.subtype)
            if message.result:
                texts = [message.result]
    reply = "".join(texts).strip()
    return reply or "(Claude returned an empty response.)", session_id


def run_agent(prompt: str, model: str = None, effort: str = None,
              resume: str | None = None) -> tuple[str, str | None]:
    """Run one agent turn; return (reply text, session id). Raises on failure."""
    return asyncio.run(_run_agent_async(prompt, model or MODEL, effort or EFFORT, resume))


def now_note() -> str:
    now = datetime.now(TZ)
    return (f"[Current time: {now.strftime('%Y-%m-%d %H:%M')} {REPORT_TZ}. "
            f"Use this for the report title. Server log timestamps are UTC.]")


def ask_claude(chat_id: int, user_text: str, model: str = None, effort: str = None) -> str:
    prompt = f"{now_note()}\n{user_text}"
    try:
        reply, sid = run_agent(prompt, model=model, effort=effort, resume=sessions.get(chat_id))
    except ClaudeAuthError:
        raise
    except Exception as e:
        if chat_id not in sessions:
            log.exception("Claude error")
            return f"⚠️ Claude error: {e}"
        # The stored session may be gone (e.g. CLI cleanup) — retry fresh once.
        log.warning("Resume failed for chat %s (%s), starting a new session", chat_id, e)
        sessions.pop(chat_id, None)
        return ask_claude(chat_id, user_text, model, effort)
    if sid:
        sessions[chat_id] = sid
    return reply


def generate_report() -> str:
    """One-off health report with its own ephemeral context (no chat history)."""
    try:
        return run_agent(f"{now_note()}\n{SCHEDULED_PROMPT}")[0]
    except ClaudeAuthError:
        raise
    except Exception as e:
        log.exception("Scheduled report failed")
        return f"⚠️ Scheduled log check failed: {e}"


def investigate(focus: str) -> str:
    """Deep, on-demand investigation on the stronger model + higher effort."""
    target = focus.strip() or "overall system health and any anomalies"
    prompt = (
        f"{now_note()}\n"
        f"DEEP INVESTIGATION. Focus: {target}. Use the log tools as much as needed "
        "to root-cause — pull wider time windows, cross-check related units/containers, "
        "and correlate signals. Then reply for a phone: start with the standard "
        "<b>title</b> and <b>Status</b> line, then a short <b>Findings</b> list, a "
        "one-line <b>Root cause</b> (or best hypothesis), and <b>Next</b> steps. You "
        "may run a bit longer than a routine check if it's warranted."
    )
    try:
        return run_agent(prompt, model=ADMIN_MODEL, effort=ADMIN_EFFORT)[0]
    except ClaudeAuthError:
        raise
    except Exception as e:
        log.exception("Investigation failed")
        return f"⚠️ Investigation failed: {e}"


# --------------------------------------------------------------------------- #
# Scheduler
# --------------------------------------------------------------------------- #

def schedule_str() -> str:
    hrs = REPORT_HOURS
    steps = {hrs[i + 1] - hrs[i] for i in range(len(hrs) - 1)}
    if len(hrs) > 1 and len(steps) == 1:
        return f"every {steps.pop()}h, {hrs[0]:02d}:00–{hrs[-1]:02d}:00 {REPORT_TZ}"
    return f"at {', '.join(f'{h:02d}:00' for h in hrs)} {REPORT_TZ}"


def next_run(now: datetime) -> datetime:
    """Next scheduled datetime at/after `now` among REPORT_HOURS (top of hour)."""
    for day_offset in (0, 1):
        day = now + timedelta(days=day_offset)
        for h in REPORT_HOURS:
            cand = day.replace(hour=h, minute=0, second=0, microsecond=0)
            if cand > now:
                return cand
    return now + timedelta(hours=1)  # unreachable fallback


def broadcast_report() -> None:
    if not subscribers:
        log.info("Scheduled tick: no subscribers, skipping report")
        return
    log.info("Generating scheduled report for %d subscriber(s)", len(subscribers))
    try:
        text = telegram_html(generate_report())
    except ClaudeAuthError as e:
        log.warning("Scheduled report: Claude login needed (%s)", e)
        for chat_id in list(subscribers):
            LOGIN.begin(chat_id)
        return
    for chat_id in list(subscribers):
        send_message(chat_id, text)


def scheduler_loop() -> None:
    last_key = None
    log.info("Scheduler: %s at hours %s (%s)",
             ",".join(f"{h:02d}:00" for h in REPORT_HOURS), REPORT_HOURS, REPORT_TZ)
    while _running:
        now = datetime.now(TZ)
        if now.hour in REPORT_HOURS and now.minute == 0:
            key = now.strftime("%Y-%m-%d-%H")
            if key != last_key:
                last_key = key
                try:
                    broadcast_report()
                except Exception:
                    log.exception("Scheduled report error")
        for _ in range(20):  # ~20s tick, but stay responsive to shutdown
            if not _running:
                return
            time.sleep(1)


# --------------------------------------------------------------------------- #
# Message handling
# --------------------------------------------------------------------------- #

def authorized(user: dict) -> bool:
    if not ALLOWED_USER_IDS and not ALLOWED_USERNAMES:
        return True
    return (str(user.get("id")) in ALLOWED_USER_IDS
            or (user.get("username") or "").lower() in ALLOWED_USERNAMES)


def is_admin(user: dict) -> bool:
    if not ADMIN_USER_IDS and not ADMIN_USERNAMES:
        return True  # no allow-list configured at all — same as authorized()
    return (str(user.get("id")) in ADMIN_USER_IDS
            or (user.get("username") or "").lower() in ADMIN_USERNAMES)


def opus_mode_on(chat_id: int) -> bool:
    deadline = opus_mode.get(chat_id)
    if deadline and time.monotonic() < deadline:
        return True
    opus_mode.pop(chat_id, None)
    return False


# Shown as the Telegram "Menu" button (registered with setMyCommands at startup).
BOT_COMMANDS = [
    ("report", "Raport de sănătate acum"),
    ("adminask", "Întrebare pe Opus 4.8 (fără text = mod Opus)"),
    ("investigate", "Investigație detaliată pe Opus 4.8"),
    ("normal", "Înapoi la modelul ieftin"),
    ("status", "Model, program rapoarte, abonare"),
    ("subscribe", "Pornește rapoartele automate"),
    ("unsubscribe", "Oprește rapoartele automate"),
    ("reset", "Șterge contextul conversației"),
    ("login", "Reconectează abonamentul Claude"),
    ("help", "Ajutor"),
]


def help_text() -> str:
    return (
        "Scrie-mi în limbaj natural ce vrei să verific în loguri.\n"
        f"Verificările obișnuite rulează pe <b>{short_model(MODEL)}</b> (ieftin).\n"
        "Surse: journal systemd, containere Docker, /var/log, logul aplicației.\n\n"
        "/report — raport acum\n"
        f"/adminask &lt;întrebare&gt; — răspuns pe {short_model(ADMIN_MODEL)}\n"
        f"/adminask — mod {short_model(ADMIN_MODEL)} pentru toate mesajele "
        f"({OPUS_MODE_MINUTES} min)\n"
        "/normal — înapoi la modelul ieftin\n"
        f"/investigate &lt;subiect&gt; — root-cause detaliat ({short_model(ADMIN_MODEL)})\n"
        "/subscribe · /unsubscribe — rapoarte automate\n"
        "/status — model, program, abonare\n"
        "/reset — șterge contextul\n"
        "/login — reconectează abonamentul Claude"
    )


def with_footer(reply: str, model: str) -> str:
    return f"{telegram_html(reply)}\n\n<i>· {short_model(model)}</i>"


def handle_message(msg: dict) -> None:
    chat_id = msg["chat"]["id"]
    user = msg.get("from", {})
    user_id = user.get("id")
    text = (msg.get("text") or "").strip()

    if not authorized(user):
        log.info("Blocked unauthorized user %s (@%s)", user_id, user.get("username"))
        send_message(chat_id, "Sorry, you're not authorized to use this bot.")
        return

    if not text:
        send_message(chat_id, "Deocamdată pot procesa doar mesaje text.")
        return

    if not USE_API_KEY and LOGIN.handle_text(chat_id, text):
        return

    # Commands
    if text.startswith("/"):
        cmd = text.split()[0].lower().split("@")[0]
        parts = text.split(maxsplit=1)
        arg = parts[1].strip() if len(parts) > 1 else ""
        if cmd == "/start":
            subscribers.add(chat_id)
            save_subscribers()
            send_message(chat_id,
                         "🩺 <b>BerlinStar log agent</b>\n"
                         "Verific logurile serverului și trimit un raport scurt.\n\n"
                         f"✅ Abonat la rapoarte automate ({schedule_str()}).\n\n"
                         "Exemple:\n"
                         "• <i>quick health check</i>\n"
                         "• <i>erori în deploy-backend-1 în ultima oră</i>\n"
                         "• <i>login-uri SSH eșuate azi?</i>\n\n" + help_text())
            return
        if cmd == "/help":
            send_message(chat_id, help_text())
            return
        if cmd == "/login":
            if USE_API_KEY:
                send_message(chat_id, "This bot uses ANTHROPIC_API_KEY (USE_API_KEY=1), not the subscription.")
            else:
                LOGIN.begin(chat_id, force_new=True)
            return
        if cmd == "/report":
            send_typing(chat_id)
            send_message(chat_id, with_footer(generate_report(), MODEL))
            return
        if cmd in ("/adminask", "/investigate") and not is_admin(user):
            send_message(chat_id, "⛔ Comanda asta e doar pentru admini.")
            return
        if cmd == "/adminask":
            if not arg:
                opus_mode[chat_id] = time.monotonic() + OPUS_MODE_MINUTES * 60
                send_message(chat_id,
                             f"🧠 Mod <b>{short_model(ADMIN_MODEL)}</b> activ pentru "
                             f"{OPUS_MODE_MINUTES} min. Toate mesajele merg pe "
                             f"{short_model(ADMIN_MODEL)}.\n/normal — înapoi la "
                             f"{short_model(MODEL)}")
                return
            send_message(chat_id, f"🧠 Întreb {short_model(ADMIN_MODEL)}…")
            send_typing(chat_id)
            reply = ask_claude(chat_id, arg, ADMIN_MODEL, ADMIN_EFFORT)
            send_message(chat_id, with_footer(reply, ADMIN_MODEL))
            return
        if cmd == "/normal":
            was_on = opus_mode_on(chat_id)
            opus_mode.pop(chat_id, None)
            send_message(chat_id, f"💸 Înapoi pe {short_model(MODEL)}." if was_on
                         else f"Deja pe {short_model(MODEL)}.")
            return
        if cmd == "/investigate":
            send_message(chat_id, f"🔎 Investighez pe {short_model(ADMIN_MODEL)}… (mai lent)")
            send_typing(chat_id)
            send_message(chat_id, with_footer(investigate(arg), ADMIN_MODEL))
            return
        if cmd == "/subscribe":
            subscribers.add(chat_id)
            save_subscribers()
            send_message(chat_id, f"✅ Abonat. Rapoarte automate {schedule_str()}.")
            return
        if cmd == "/unsubscribe":
            subscribers.discard(chat_id)
            save_subscribers()
            send_message(chat_id, "🔕 Dezabonat de la rapoartele automate.")
            return
        if cmd == "/status":
            sub = "on" if chat_id in subscribers else "off"
            nxt = next_run(datetime.now(TZ)).strftime("%a %H:%M")
            if opus_mode_on(chat_id):
                left = int((opus_mode[chat_id] - time.monotonic()) / 60) + 1
                mode = f"{short_model(ADMIN_MODEL)} (încă ~{left} min)"
            else:
                mode = short_model(MODEL)
            send_message(chat_id,
                         f"<b>Status</b>\n"
                         f"• Model curent: {mode}\n"
                         f"• Rapoarte automate: {sub} ({short_model(MODEL)})\n"
                         f"• Program: {schedule_str()}\n"
                         f"• Următorul: {nxt}\n"
                         f"• Abonați: {len(subscribers)}")
            return
        if cmd == "/reset":
            sessions.pop(chat_id, None)
            opus_mode.pop(chat_id, None)
            send_message(chat_id, "🧹 Conversație ștearsă.")
            return
        # Unknown command → fall through and treat as a normal message.

    send_typing(chat_id)
    if opus_mode_on(chat_id) and is_admin(user):
        model, effort = ADMIN_MODEL, ADMIN_EFFORT
    else:
        model, effort = MODEL, EFFORT
    reply = ask_claude(chat_id, text, model, effort)
    send_message(chat_id, with_footer(reply, model))


# --------------------------------------------------------------------------- #
# Main loop
# --------------------------------------------------------------------------- #

def main() -> None:
    def stop(*_):
        global _running
        _running = False
        log.info("Shutting down…")

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    me = tg("getMe")
    if not me:
        sys.exit("Could not reach Telegram — check the bot token.")
    log.info("Bot @%s is up. Model=%s effort=%s (admin=%s/%s). Waiting for messages…",
             me.get("username"), MODEL, EFFORT or "-", ADMIN_MODEL, ADMIN_EFFORT)
    if not ALLOWED_USER_IDS and not ALLOWED_USERNAMES:
        log.warning("No ALLOWED_USER_IDS/ALLOWED_USERNAMES set — the bot answers anyone!")

    # Telegram "Menu" button with all commands.
    tg("setMyCommands", commands=[{"command": c, "description": d} for c, d in BOT_COMMANDS])
    tg("setChatMenuButton", menu_button={"type": "commands"})

    threading.Thread(target=scheduler_loop, name="scheduler", daemon=True).start()

    offset = None
    while _running:
        updates = tg("getUpdates", offset=offset, timeout=50,
                     allowed_updates=["message"])
        if not updates:
            continue
        for update in updates:
            offset = update["update_id"] + 1
            msg = update.get("message")
            if msg:
                try:
                    handle_message(msg)
                except ClaudeAuthError as e:
                    log.warning("Claude login needed: %s", e)
                    LOGIN.begin(msg["chat"]["id"])
                except Exception:
                    log.exception("Error handling message")
                    try:
                        send_message(msg["chat"]["id"],
                                     "⚠️ Something went wrong handling that message.")
                    except Exception:
                        pass


if __name__ == "__main__":
    main()
