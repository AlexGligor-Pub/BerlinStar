#!/usr/bin/env python3
"""BerlinQA — Claude Code over Telegram.

Bridges a Telegram chat to the `claude` CLI running in print/stream mode, so a
message from the phone behaves like a prompt typed in the terminal: the agent
reads files, runs commands and edits code on this server, and tool activity is
streamed back into a live "working…" message.

Run:  ./bot.py          (or as the berlinqa-bot user service)
"""
from __future__ import annotations

import html
import json
import logging
import os
import queue
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

HERE = Path(__file__).resolve().parent


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

def load_dotenv(path: Path) -> None:
    """Minimal .env loader. Does not overwrite variables already in the env."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv(HERE / ".env")

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/home/berlinqa/.local/bin/claude").strip()
DEFAULT_WORKDIR = os.environ.get("WORKDIR", "/home/berlinqa/berlinstar").strip()
DEFAULT_MODEL = os.environ.get("CLAUDE_MODEL", "opus").strip()
DEFAULT_EFFORT = os.environ.get("CLAUDE_EFFORT", "").strip()   # "" = CLI default
PERMISSION_MODE = os.environ.get("PERMISSION_MODE", "bypassPermissions").strip()
RUN_TIMEOUT = int(os.environ.get("RUN_TIMEOUT", "1800"))        # seconds per prompt
SH_TIMEOUT = int(os.environ.get("SH_TIMEOUT", "120"))
TZ_NAME = os.environ.get("TZ_NAME", "Europe/Bucharest").strip()
ALLOWED_USER_IDS = {
    u.strip() for u in os.environ.get("ALLOWED_USER_IDS", "").split(",") if u.strip()
}

API = f"https://api.telegram.org/bot{TOKEN}"
STATE_FILE = HERE / "state.json"
TG_LIMIT = 4096
CHUNK = 3500          # leave headroom for HTML tags added by the converter
PROGRESS_EVERY = 2.0  # seconds between live-progress edits
MODELS = {"opus", "sonnet", "haiku", "fable"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}

try:
    TZ = ZoneInfo(TZ_NAME)
except Exception:
    TZ, TZ_NAME = ZoneInfo("UTC"), "UTC"

if not TOKEN:
    sys.exit("TELEGRAM_BOT_TOKEN is not set (put it in .env).")
if not os.environ.get("ANTHROPIC_API_KEY") and not (Path.home() / ".claude/.credentials.json").exists():
    sys.exit("No Anthropic credentials: set ANTHROPIC_API_KEY in .env or log the CLI in.")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("berlinqa-bot")

STARTED_AT = time.time()
_running = True


# --------------------------------------------------------------------------- #
# State (owners, per-chat session/model/cwd, update offset)
# --------------------------------------------------------------------------- #

_state_lock = threading.Lock()


def _blank_state() -> dict:
    return {"owners": [], "offset": None, "chats": {}}


def load_state() -> dict:
    try:
        data = json.loads(STATE_FILE.read_text())
        base = _blank_state()
        base.update(data)
        return base
    except Exception:
        return _blank_state()


STATE = load_state()


def save_state() -> None:
    with _state_lock:
        try:
            tmp = STATE_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(STATE, indent=2))
            tmp.replace(STATE_FILE)
        except Exception:
            log.exception("Could not save state")


def chat_state(chat_id: int) -> dict:
    chats = STATE.setdefault("chats", {})
    cs = chats.setdefault(str(chat_id), {})
    cs.setdefault("session_id", None)
    cs.setdefault("cwd", DEFAULT_WORKDIR)
    cs.setdefault("model", DEFAULT_MODEL)
    cs.setdefault("effort", DEFAULT_EFFORT)
    cs.setdefault("cost", 0.0)
    cs.setdefault("turns", 0)
    return cs


# --------------------------------------------------------------------------- #
# Telegram helpers
# --------------------------------------------------------------------------- #

def tg(method: str, **params):
    """Call a Bot API method; return the `result` payload or None."""
    try:
        r = requests.post(f"{API}/{method}", json=params, timeout=70)
        data = r.json()
        if not data.get("ok"):
            log.warning("Telegram %s failed: %s", method, data.get("description"))
            return None
        return data.get("result")
    except requests.RequestException as e:
        log.warning("Telegram %s network error: %s", method, e)
        return None


_CODE_BLOCK = re.compile(r"```[ \t]*[\w+-]*\n(.*?)```", re.S)


def md_to_html(text: str) -> str:
    """Convert the model's markdown to the small HTML subset Telegram accepts."""
    blocks: list[str] = []

    def stash(m: re.Match) -> str:
        blocks.append(m.group(1))
        return f"\x00CB{len(blocks) - 1}\x00"

    text = _CODE_BLOCK.sub(stash, text)
    out = html.escape(text, quote=False)
    out = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out, flags=re.S)
    out = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", out)
    out = re.sub(r"^#{1,6}\s*(.+)$", r"<b>\1</b>", out, flags=re.M)
    out = re.sub(r"^(\s*)[-*+]\s+", r"\1• ", out, flags=re.M)
    out = re.sub(r"^\s*---+\s*$", "──────────", out, flags=re.M)

    def restore(m: re.Match) -> str:
        return f"<pre><code>{html.escape(blocks[int(m.group(1))], quote=False)}</code></pre>"

    return re.sub(r"\x00CB(\d+)\x00", restore, out)


def split_md(text: str, limit: int = CHUNK) -> list[str]:
    """Split markdown at line boundaries, keeping code fences balanced."""
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    cur: list[str] = []
    size = 0
    fence = False
    for line in text.split("\n"):
        pieces = [line[i:i + limit] for i in range(0, len(line), limit)] or [""]
        for p in pieces:
            if size + len(p) + 1 > limit and cur:
                if fence:
                    cur.append("```")
                chunks.append("\n".join(cur))
                cur = ["```"] if fence else []
                size = 4 if fence else 0
            cur.append(p)
            size += len(p) + 1
            if p.lstrip().startswith("```"):
                fence = not fence
    if cur:
        chunks.append("\n".join(cur))
    return [c for c in chunks if c.strip()]


def send(chat_id: int, text: str, markdown: bool = True) -> int | None:
    """Send (splitting as needed). Returns the message_id of the last chunk."""
    last = None
    for chunk in split_md(text) if markdown else split_md(text, TG_LIMIT - 16):
        body = md_to_html(chunk) if markdown else html.escape(chunk, quote=False)
        res = tg("sendMessage", chat_id=chat_id, text=body, parse_mode="HTML",
                 disable_web_page_preview=True)
        if res is None:  # bad HTML → retry as plain text
            res = tg("sendMessage", chat_id=chat_id,
                     text=re.sub(r"<[^>]+>", "", chunk)[:TG_LIMIT],
                     disable_web_page_preview=True)
        if res:
            last = res.get("message_id")
    return last


def edit(chat_id: int, message_id: int, text: str) -> None:
    if tg("editMessageText", chat_id=chat_id, message_id=message_id,
          text=text[:TG_LIMIT], parse_mode="HTML",
          disable_web_page_preview=True) is None:
        tg("editMessageText", chat_id=chat_id, message_id=message_id,
           text=re.sub(r"<[^>]+>", "", text)[:TG_LIMIT])


def typing(chat_id: int) -> None:
    tg("sendChatAction", chat_id=chat_id, action="typing")


# --------------------------------------------------------------------------- #
# Claude Code runner
# --------------------------------------------------------------------------- #

RUNS: dict[int, "Run"] = {}      # chat_id -> active Run
RUNS_LOCK = threading.Lock()


def human_time(seconds: float) -> str:
    s = int(seconds)
    return f"{s}s" if s < 60 else f"{s // 60}m {s % 60:02d}s"


def short(s: str, n: int = 58) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def describe_tool(name: str, inp: dict, cwd: str) -> str | None:
    """One short line describing a tool call, for the live progress message."""
    def rel(p: str) -> str:
        p = str(p or "")
        return p[len(cwd) + 1:] if p.startswith(cwd + "/") else p

    if name == "Bash":
        return f"<code>$ {html.escape(short(inp.get('command', '')), quote=False)}</code>"
    if name in ("Read", "NotebookEdit"):
        return f"📖 {html.escape(short(rel(inp.get('file_path', ''))), quote=False)}"
    if name in ("Edit", "Write"):
        icon = "✏️" if name == "Edit" else "📝"
        return f"{icon} {html.escape(short(rel(inp.get('file_path', ''))), quote=False)}"
    if name in ("Grep", "Glob"):
        pat = inp.get("pattern", "")
        return f"🔍 {html.escape(short(pat), quote=False)}"
    if name in ("WebSearch", "WebFetch"):
        return f"🌐 {html.escape(short(inp.get('query') or inp.get('url', '')), quote=False)}"
    if name in ("Agent", "Task"):
        return f"🤖 {html.escape(short(inp.get('description', 'subagent')), quote=False)}"
    if name == "TodoWrite":
        return None
    return f"🔧 {html.escape(short(name), quote=False)}"


class Run:
    """One `claude -p` invocation, streamed into a live Telegram message."""

    def __init__(self, chat_id: int, prompt: str):
        self.chat_id = chat_id
        self.prompt = prompt
        self.proc: subprocess.Popen | None = None
        self.cancelled = False
        self.lines: list[str] = []
        self.tools = 0
        self.errors = 0
        self.thinking = False
        self.started = time.time()
        self.msg_id: int | None = None
        self._last_edit = 0.0

    # -- live progress ----------------------------------------------------- #
    def progress_text(self) -> str:
        head = f"⚙️ <b>Lucrez…</b> <i>{human_time(time.time() - self.started)}</i>"
        if self.thinking and not self.lines:
            head += "\n💭 gândesc…"
        body = "\n".join(self.lines[-8:])
        return f"{head}\n{body}" if body else head

    def push(self, line: str | None) -> None:
        if line:
            self.lines.append(line)
        self.refresh()

    def refresh(self, force: bool = False) -> None:
        now = time.time()
        if not force and now - self._last_edit < PROGRESS_EVERY:
            return
        self._last_edit = now
        if self.msg_id is None:
            res = tg("sendMessage", chat_id=self.chat_id, text=self.progress_text(),
                     parse_mode="HTML")
            self.msg_id = res.get("message_id") if res else None
        else:
            edit(self.chat_id, self.msg_id, self.progress_text())

    def cancel(self) -> bool:
        self.cancelled = True
        p = self.proc
        if p and p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                return True
            except Exception:
                log.exception("Could not kill run")
        return False

    # -- execution --------------------------------------------------------- #
    def build_cmd(self, cs: dict, resume: bool) -> list[str]:
        cmd = [CLAUDE_BIN, "-p", self.prompt,
               "--model", cs["model"],
               "--permission-mode", PERMISSION_MODE,
               "--output-format", "stream-json", "--verbose"]
        if cs.get("effort"):
            cmd += ["--effort", cs["effort"]]
        if resume and cs.get("session_id"):
            cmd += ["--resume", cs["session_id"]]
        return cmd

    def execute(self) -> None:
        cs = chat_state(self.chat_id)
        cwd = cs["cwd"]
        if not Path(cwd).is_dir():
            cwd = cs["cwd"] = DEFAULT_WORKDIR

        self.refresh(force=True)
        result = self._spawn(cs, cwd, resume=True)
        if result is None and cs.get("session_id") and not self.cancelled:
            # Stale/missing session on disk — start a fresh one and say so.
            log.info("Resume failed for chat %s, starting a new session", self.chat_id)
            cs["session_id"] = None
            self.lines.append("↻ sesiunea veche nu mai există — pornesc una nouă")
            result = self._spawn(cs, cwd, resume=False)
        save_state()
        self._finish(result)

    def _spawn(self, cs: dict, cwd: str, resume: bool) -> dict | None:
        """Run the CLI once. Returns the `result` event, or None on hard failure."""
        env = os.environ.copy()
        env.setdefault("HOME", str(Path.home()))
        env["CLAUDE_CODE_ENTRYPOINT"] = "telegram-bot"
        texts: list[str] = []
        final: dict | None = None
        stderr_buf: list[str] = []

        try:
            self.proc = subprocess.Popen(
                self.build_cmd(cs, resume), cwd=cwd, env=env,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL, text=True, bufsize=1,
                start_new_session=True,
            )
        except FileNotFoundError:
            self.error_text = f"Nu găsesc CLI-ul claude la {CLAUDE_BIN}"
            return None

        threading.Thread(target=lambda: stderr_buf.append(self.proc.stderr.read()),
                         daemon=True).start()
        watchdog = threading.Timer(RUN_TIMEOUT, self.cancel)
        watchdog.start()

        try:
            for raw in self.proc.stdout:
                if not raw.strip():
                    continue
                try:
                    ev = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                kind = ev.get("type")

                if kind == "system" and ev.get("subtype") == "init":
                    if ev.get("session_id"):
                        cs["session_id"] = ev["session_id"]

                elif kind == "assistant":
                    for block in ev.get("message", {}).get("content", []):
                        btype = block.get("type")
                        if btype == "thinking":
                            self.thinking = True
                            self.refresh()
                        elif btype == "tool_use":
                            self.tools += 1
                            self.push(describe_tool(block.get("name", "?"),
                                                    block.get("input") or {}, cwd))
                        elif btype == "text" and block.get("text", "").strip():
                            texts.append(block["text"])

                elif kind == "user":
                    for block in ev.get("message", {}).get("content", []) or []:
                        if isinstance(block, dict) and block.get("type") == "tool_result" \
                                and block.get("is_error"):
                            self.errors += 1

                elif kind == "result":
                    final = ev
        finally:
            watchdog.cancel()
            if self.proc:
                self.proc.wait()

        if self.cancelled:
            return {"subtype": "cancelled"}

        if final is None:
            err = (stderr_buf[0] if stderr_buf else "") or ""
            if resume and cs.get("session_id") and re.search(
                    r"session|resume|not found|No conversation", err, re.I):
                return None
            self.error_text = short(err.strip().splitlines()[-1], 300) if err.strip() \
                else f"claude a ieșit cu codul {self.proc.returncode}"
            return None

        final.setdefault("result", "\n\n".join(texts).strip())
        if final.get("session_id"):
            cs["session_id"] = final["session_id"]
        cs["cost"] = round(cs.get("cost", 0.0) + (final.get("total_cost_usd") or 0.0), 4)
        cs["turns"] = cs.get("turns", 0) + 1
        return final

    def _finish(self, final: dict | None) -> None:
        elapsed = human_time(time.time() - self.started)
        if self.cancelled and (final is None or final.get("subtype") == "cancelled"):
            summary = f"🛑 <b>Oprit</b> · {elapsed} · {self.tools} unelte"
            self._replace(summary)
            return

        if final is None:
            reason = getattr(self, "error_text", "eroare necunoscută")
            self._replace(f"❌ <b>A eșuat</b> · {elapsed}\n<code>"
                          f"{html.escape(reason, quote=False)}</code>")
            return

        bits = [elapsed, f"{self.tools} unelte"]
        if self.errors:
            bits.append(f"{self.errors} erori")
        cost = final.get("total_cost_usd")
        if cost:
            bits.append(f"${cost:.2f}")
        icon = "✅" if final.get("subtype") == "success" else "⚠️"
        self._replace(f"{icon} {' · '.join(bits)}")

        text = (final.get("result") or "").strip()
        if not text:
            text = "_(fără răspuns text)_"
        send(self.chat_id, text)

    def _replace(self, summary: str) -> None:
        if self.msg_id:
            edit(self.chat_id, self.msg_id, summary)
        else:
            tg("sendMessage", chat_id=self.chat_id, text=summary, parse_mode="HTML")


# --------------------------------------------------------------------------- #
# Per-chat worker queues (one prompt at a time, in order)
# --------------------------------------------------------------------------- #

QUEUES: dict[int, queue.Queue] = {}
QUEUES_LOCK = threading.Lock()


def enqueue(chat_id: int, prompt: str) -> int:
    with QUEUES_LOCK:
        q = QUEUES.get(chat_id)
        if q is None:
            q = QUEUES[chat_id] = queue.Queue()
            threading.Thread(target=worker, args=(chat_id, q),
                             name=f"chat-{chat_id}", daemon=True).start()
        q.put(prompt)
        return q.qsize()


def worker(chat_id: int, q: queue.Queue) -> None:
    while _running:
        try:
            prompt = q.get(timeout=1)
        except queue.Empty:
            continue
        run = Run(chat_id, prompt)
        with RUNS_LOCK:
            RUNS[chat_id] = run
        try:
            typing(chat_id)
            run.execute()
        except Exception:
            log.exception("Run failed")
            send(chat_id, "⚠️ Ceva a crăpat în rularea agentului. Vezi logurile serviciului.")
        finally:
            with RUNS_LOCK:
                RUNS.pop(chat_id, None)
            q.task_done()


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

HELP = (
    "<b>BerlinQA · Claude Opus 5 pe server</b>\n"
    "Scrie-mi normal și lucrez ca în terminal: citesc fișiere, rulez comenzi, "
    "editez cod, fac deploy.\n\n"
    "<b>Comenzi</b>\n"
    "/new — chat nou (uită contextul)\n"
    "/stop — oprește ce rulează acum\n"
    "/status — model, folder, sesiune, cost\n"
    "/cd &lt;folder&gt; — schimbă directorul de lucru\n"
    "/model &lt;opus|sonnet|haiku|fable&gt; — schimbă modelul\n"
    "/effort &lt;low|medium|high|xhigh|max&gt; — cât de adânc gândește\n"
    "/sh &lt;comandă&gt; — shell direct, fără agent\n"
    "/cost — cât a costat sesiunea\n"
    "/ping — sunt viu?\n"
    "/id — ID-ul tău Telegram\n"
    "/help — asta"
)


def server_uptime() -> str:
    try:
        return human_time(float(Path("/proc/uptime").read_text().split()[0]))
    except Exception:
        return "?"


def cmd_status(chat_id: int) -> str:
    cs = chat_state(chat_id)
    with RUNS_LOCK:
        busy = chat_id in RUNS
    with QUEUES_LOCK:
        pending = QUEUES[chat_id].qsize() if chat_id in QUEUES else 0
    sid = cs.get("session_id")
    return (
        "<b>Status</b>\n"
        f"• Model: <code>{cs['model']}</code>"
        + (f" · effort <code>{cs['effort']}</code>" if cs.get("effort") else "") + "\n"
        f"• Folder: <code>{html.escape(cs['cwd'], quote=False)}</code>\n"
        f"• Sesiune: <code>{sid[:8] if sid else 'nouă'}</code> · {cs.get('turns', 0)} mesaje\n"
        f"• Cost sesiune: ${cs.get('cost', 0.0):.2f}\n"
        f"• Acum: {'rulează ceva' if busy else 'liber'}"
        + (f" · {pending} în coadă" if pending else "") + "\n"
        f"• Bot pornit de: {human_time(time.time() - STARTED_AT)}\n"
        f"• Server pornit de: {server_uptime()}"
    )


def run_shell(chat_id: int, command: str) -> None:
    cs = chat_state(chat_id)
    try:
        p = subprocess.run(command, shell=True, cwd=cs["cwd"], capture_output=True,
                           text=True, timeout=SH_TIMEOUT)
        out = (p.stdout or "") + (("\n" + p.stderr) if p.stderr else "")
        out = out.strip() or "(fără output)"
        head = "✅" if p.returncode == 0 else f"❌ exit {p.returncode}"
        send(chat_id, f"{head}\n```\n{out[-3000:]}\n```")
    except subprocess.TimeoutExpired:
        send(chat_id, f"⏱ Comanda a depășit {SH_TIMEOUT}s și a fost oprită.")
    except Exception as e:
        send(chat_id, f"❌ {e}")


def handle_command(chat_id: int, user_id: int, text: str) -> bool:
    """Returns True if the message was a command and has been handled."""
    cmd = text.split()[0].lower().split("@")[0]
    arg = text[len(text.split()[0]):].strip()
    cs = chat_state(chat_id)

    if cmd in ("/start", "/help"):
        intro = (f"👋 Salut! Sunt online pe <b>{html.escape(os.uname().nodename)}</b>.\n\n"
                 if cmd == "/start" else "")
        tg("sendMessage", chat_id=chat_id, text=intro + HELP, parse_mode="HTML")
        return True

    if cmd in ("/new", "/clear", "/reset"):
        cs["session_id"] = None
        cs["cost"] = 0.0
        cs["turns"] = 0
        save_state()
        send(chat_id, "🆕 Chat nou. Am uitat tot contextul de dinainte.")
        return True

    if cmd == "/stop":
        with RUNS_LOCK:
            run = RUNS.get(chat_id)
        if run and run.cancel():
            send(chat_id, "🛑 Opresc…")
        else:
            send(chat_id, "Nu rulează nimic acum.")
        return True

    if cmd == "/status":
        tg("sendMessage", chat_id=chat_id, text=cmd_status(chat_id), parse_mode="HTML")
        return True

    if cmd == "/cost":
        send(chat_id, f"💰 Sesiunea curentă: ${cs.get('cost', 0.0):.2f} "
                      f"({cs.get('turns', 0)} mesaje)")
        return True

    if cmd == "/ping":
        send(chat_id, f"🟢 Viu. Bot: {human_time(time.time() - STARTED_AT)} · "
                      f"server: {server_uptime()}")
        return True

    if cmd == "/id":
        send(chat_id, f"User ID: `{user_id}`\nChat ID: `{chat_id}`")
        return True

    if cmd == "/cd":
        if not arg:
            send(chat_id, f"Folder curent: `{cs['cwd']}`\nFolosire: `/cd /cale/noua`")
            return True
        target = Path(arg).expanduser()
        if not target.is_absolute():
            target = Path(cs["cwd"]) / target
        target = target.resolve()
        if not target.is_dir():
            send(chat_id, f"❌ Nu există folderul `{target}`")
            return True
        cs["cwd"] = str(target)
        cs["session_id"] = None
        save_state()
        send(chat_id, f"📂 Lucrez acum în `{target}`\n(sesiune nouă, contextul e legat de folder)")
        return True

    if cmd == "/model":
        if arg.lower() not in MODELS:
            send(chat_id, f"Model curent: `{cs['model']}`\nOpțiuni: "
                          + ", ".join(sorted(MODELS)))
            return True
        cs["model"] = arg.lower()
        save_state()
        send(chat_id, f"🧠 Model schimbat pe `{cs['model']}`")
        return True

    if cmd == "/effort":
        if arg.lower() not in EFFORTS:
            send(chat_id, f"Effort curent: `{cs.get('effort') or 'implicit'}`\nOpțiuni: "
                          + ", ".join(sorted(EFFORTS)))
            return True
        cs["effort"] = arg.lower()
        save_state()
        send(chat_id, f"⚡ Effort setat pe `{cs['effort']}`")
        return True

    if cmd == "/sh":
        if not arg:
            send(chat_id, "Folosire: `/sh docker ps`")
            return True
        threading.Thread(target=run_shell, args=(chat_id, arg), daemon=True).start()
        return True

    return False


# --------------------------------------------------------------------------- #
# Message dispatch
# --------------------------------------------------------------------------- #

def authorized(user_id: int, chat_id: int) -> bool:
    """Allow-list from .env if present; otherwise the first user seen claims the bot."""
    if ALLOWED_USER_IDS:
        return str(user_id) in ALLOWED_USER_IDS
    owners = STATE.setdefault("owners", [])
    if not owners:
        owners.append(user_id)
        save_state()
        log.info("Bot claimed by user %s (chat %s)", user_id, chat_id)
        return True
    return user_id in owners


def handle_message(msg: dict) -> None:
    chat_id = msg["chat"]["id"]
    user_id = msg.get("from", {}).get("id")
    text = (msg.get("text") or msg.get("caption") or "").strip()

    if not authorized(user_id, chat_id):
        log.info("Blocked user %s", user_id)
        tg("sendMessage", chat_id=chat_id,
           text="Botul ăsta e privat. (Your user ID: %s)" % user_id)
        return

    if not text:
        send(chat_id, "Deocamdată înțeleg doar text.")
        return

    if text.startswith("/") and handle_command(chat_id, user_id, text):
        return

    depth = enqueue(chat_id, text)
    if depth > 1:
        send(chat_id, f"⏳ Pus în coadă ({depth - 1} înainte).")


# --------------------------------------------------------------------------- #
# Startup announcement
# --------------------------------------------------------------------------- #

def announce_start() -> None:
    targets = list(STATE.get("owners") or [])
    targets += [int(c) for c in STATE.get("chats", {}) if int(c) not in targets]
    if not targets:
        log.info("No known chats yet — nothing to announce. Send /start to the bot.")
        return
    up = float(Path("/proc/uptime").read_text().split()[0]) if \
        Path("/proc/uptime").exists() else 1e9
    reason = "🔄 <b>Serverul tocmai a repornit</b>" if up < 300 else "🟢 <b>Sunt online</b>"
    now = datetime.now(TZ).strftime("%H:%M, %d %b")
    body = (f"{reason}\n"
            f"Gazdă: <code>{os.uname().nodename}</code> · {now}\n"
            f"Model: <code>{DEFAULT_MODEL}</code> · folder <code>{DEFAULT_WORKDIR}</code>\n"
            f"Scrie-mi orice, sau /help.")
    for chat_id in targets:
        tg("sendMessage", chat_id=chat_id, text=body, parse_mode="HTML")


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
        sys.exit("Nu pot contacta Telegram — verifică tokenul.")
    log.info("Bot @%s up. model=%s cwd=%s perm=%s",
             me.get("username"), DEFAULT_MODEL, DEFAULT_WORKDIR, PERMISSION_MODE)

    announce_start()

    offset = STATE.get("offset")
    boot = time.time()
    while _running:
        updates = tg("getUpdates", offset=offset, timeout=50, allowed_updates=["message"])
        if updates is None:      # network/API error — back off instead of hot-looping
            time.sleep(5)
            continue
        if not updates:          # normal long-poll timeout, nothing new
            continue
        for update in updates:
            offset = update["update_id"] + 1
            STATE["offset"] = offset
            msg = update.get("message")
            if not msg:
                continue
            # Ignore anything sent while the bot was down for more than a minute.
            if msg.get("date", 0) < boot - 60:
                log.info("Skipping stale message from %s", msg.get("date"))
                continue
            try:
                handle_message(msg)
            except Exception:
                log.exception("Error handling message")
                try:
                    send(msg["chat"]["id"], "⚠️ Eroare la procesarea mesajului.")
                except Exception:
                    pass
        save_state()


if __name__ == "__main__":
    main()
