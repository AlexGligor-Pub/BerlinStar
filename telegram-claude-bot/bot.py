#!/usr/bin/env python3
"""Telegram <-> Claude bridge.

Long-polls Telegram for messages and answers each one with Claude, keeping a
short per-chat conversation history so follow-up questions have context.

Run:  ./.venv/bin/python bot.py
"""
from __future__ import annotations

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

import anthropic
import requests

import logtools

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
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6").strip()
EFFORT = os.environ.get("CLAUDE_EFFORT", "medium").strip()
INVESTIGATE_MODEL = os.environ.get("INVESTIGATE_MODEL", "claude-opus-4-8").strip()
INVESTIGATE_EFFORT = os.environ.get("INVESTIGATE_EFFORT", "high").strip()
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

MAX_TURNS = 20          # user+assistant messages kept per chat (history trim)
MAX_TOKENS = 4096       # Claude max output tokens per reply
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
if not os.environ.get("ANTHROPIC_API_KEY"):
    sys.exit("ANTHROPIC_API_KEY is not set (export it or add it to .env).")

API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("tg-claude")

claude = anthropic.Anthropic()
histories: dict[int, list[dict]] = {}  # chat_id -> list of {role, content}
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

def _is_tool_result_msg(msg) -> bool:
    content = msg.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        return isinstance(first, dict) and first.get("type") == "tool_result"
    return False


def trim_history(history: list) -> None:
    """Keep the last MAX_TURNS messages, but never start on an assistant turn
    or an orphaned tool_result (both would make the API 400)."""
    while len(history) > MAX_TURNS:
        history.pop(0)
    while history and (history[0].get("role") != "user"
                       or _is_tool_result_msg(history[0])):
        history.pop(0)


def run_agent(messages: list, model: str = None, effort: str = None) -> str:
    """Run the tool-use loop over `messages` (mutated in place); return reply text.
    Raises anthropic.APIError on API failure."""
    model = model or MODEL
    effort = effort or EFFORT
    last = None
    for _ in range(MAX_TOOL_ITERS):
        last = claude.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            tools=logtools.TOOLS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": last.content})

        if last.stop_reason != "tool_use":
            break

        results = []
        for block in last.content:
            if block.type != "tool_use":
                continue
            log.info("tool_use %s %s", block.name, block.input)
            output = logtools.run_tool(block.name, block.input)
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": output,
            })
        messages.append({"role": "user", "content": results})
    else:
        return "⚠️ Stopped after too many tool calls. Try narrowing the request."

    reply = "".join(b.text for b in last.content if b.type == "text").strip()
    return reply or "(Claude returned an empty response.)"


def now_note() -> str:
    now = datetime.now(TZ)
    return (f"[Current time: {now.strftime('%Y-%m-%d %H:%M')} {REPORT_TZ}. "
            f"Use this for the report title. Server log timestamps are UTC.]")


def ask_claude(chat_id: int, user_text: str) -> str:
    history = histories.setdefault(chat_id, [])
    history.append({"role": "user", "content": f"{now_note()}\n{user_text}"})
    trim_history(history)
    try:
        return run_agent(history)
    except anthropic.APIError as e:
        log.exception("Claude API error")
        return f"⚠️ Claude error: {getattr(e, 'message', str(e))}"


def generate_report() -> str:
    """One-off health report with its own ephemeral context (no chat history)."""
    try:
        return run_agent([{"role": "user", "content": f"{now_note()}\n{SCHEDULED_PROMPT}"}])
    except anthropic.APIError as e:
        log.exception("Scheduled report failed")
        return f"⚠️ Scheduled log check failed: {getattr(e, 'message', str(e))}"


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
        return run_agent([{"role": "user", "content": prompt}],
                         model=INVESTIGATE_MODEL, effort=INVESTIGATE_EFFORT)
    except anthropic.APIError as e:
        log.exception("Investigation failed")
        return f"⚠️ Investigation failed: {getattr(e, 'message', str(e))}"


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
    text = telegram_html(generate_report())
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

def authorized(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or str(user_id) in ALLOWED_USER_IDS


def handle_message(msg: dict) -> None:
    chat_id = msg["chat"]["id"]
    user = msg.get("from", {})
    user_id = user.get("id")
    text = (msg.get("text") or "").strip()

    if not text:
        send_message(chat_id, "I can only handle text messages right now.")
        return

    if not authorized(user_id):
        log.info("Blocked unauthorized user %s", user_id)
        send_message(chat_id, "Sorry, you're not authorized to use this bot.")
        return

    # Commands
    if text.startswith("/"):
        cmd = text.split()[0].lower().split("@")[0]
        if cmd == "/start":
            subscribers.add(chat_id)
            save_subscribers()
            send_message(chat_id,
                         "🩺 <b>BerlinStar log agent</b>\n"
                         "I check the server's logs and send a short report.\n\n"
                         f"✅ You're subscribed to auto-reports ({schedule_str()}).\n\n"
                         "Try:\n"
                         "• <i>quick health check</i>\n"
                         "• <i>errors in deploy-backend-1 last hour</i>\n"
                         "• <i>any failed SSH logins today?</i>\n\n"
                         "/report — run one now\n"
                         "/investigate &lt;topic&gt; — deep dive (Opus)\n"
                         "/status · /unsubscribe · /help")
            return
        if cmd == "/help":
            send_message(chat_id,
                         "Ask me about the logs in plain language and I'll check "
                         "and reply with a short report.\n"
                         "Sources: systemd journal, Docker containers, /var/log, app log.\n\n"
                         "/report — report now\n"
                         "/investigate &lt;topic&gt; — deep root-cause dive (Opus)\n"
                         "/subscribe · /unsubscribe — auto-reports\n"
                         "/status — schedule & subscription\n"
                         "/reset — clear context")
            return
        if cmd == "/report":
            send_typing(chat_id)
            send_message(chat_id, telegram_html(generate_report()))
            return
        if cmd == "/investigate":
            parts = text.split(maxsplit=1)
            focus = parts[1] if len(parts) > 1 else ""
            send_message(chat_id, f"🔎 Investigating on {INVESTIGATE_MODEL}… (deeper, slower)")
            send_typing(chat_id)
            send_message(chat_id, telegram_html(investigate(focus)))
            return
        if cmd == "/subscribe":
            subscribers.add(chat_id)
            save_subscribers()
            send_message(chat_id, f"✅ Subscribed. Auto-reports {schedule_str()}.")
            return
        if cmd == "/unsubscribe":
            subscribers.discard(chat_id)
            save_subscribers()
            send_message(chat_id, "🔕 Unsubscribed from auto-reports.")
            return
        if cmd == "/status":
            sub = "on" if chat_id in subscribers else "off"
            nxt = next_run(datetime.now(TZ)).strftime("%a %H:%M")
            send_message(chat_id,
                         f"<b>Status</b>\n"
                         f"• Auto-reports: {sub}\n"
                         f"• Schedule: {schedule_str()}\n"
                         f"• Next: {nxt}\n"
                         f"• Subscribers: {len(subscribers)}")
            return
        if cmd == "/reset":
            histories.pop(chat_id, None)
            send_message(chat_id, "🧹 Conversation cleared.")
            return
        # Unknown command → fall through and treat as a normal message.

    send_typing(chat_id)
    reply = ask_claude(chat_id, text)
    send_message(chat_id, telegram_html(reply))


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
    log.info("Bot @%s is up. Model=%s effort=%s (investigate=%s/%s). Waiting for messages…",
             me.get("username"), MODEL, EFFORT, INVESTIGATE_MODEL, INVESTIGATE_EFFORT)

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
                except Exception:
                    log.exception("Error handling message")
                    try:
                        send_message(msg["chat"]["id"],
                                     "⚠️ Something went wrong handling that message.")
                    except Exception:
                        pass


if __name__ == "__main__":
    main()
