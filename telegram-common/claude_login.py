"""Claude subscription re-login over Telegram, shared by the BerlinStar bots.

When the CLI's OAuth login is missing or can't be refreshed, runs fail with an
authentication error. LoginFlow then starts `claude auth login --claudeai` —
the same flow as a manual login on a headless server: it sends the authorize
URL to Telegram, waits for the user to paste back the code shown after signing
in, feeds it to the CLI and reports the result.

Credentials land in ~/.claude, so a login completed through either bot fixes
both; a flow left pending in the other bot notices that and steps aside.
"""
from __future__ import annotations

import html
import json
import logging
import os
import re
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Callable

log = logging.getLogger("claude-login")

CREDENTIALS = Path.home() / ".claude/.credentials.json"
API_KEY_VARS = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")
AUTH_ERRORS = {"authentication_failed", "billing_error"}
_AUTH_TEXT = re.compile(
    r"not logged in|please run /login|failed to authenticate|oauth (session|token)"
    r"|invalid (api key|bearer token)|authentication_failed", re.I)
_URL = re.compile(r"https://\S+/oauth/authorize\?\S+")
_CODE = re.compile(r"^[A-Za-z0-9_\-.~#]{20,}$")

URL_WAIT = 30              # seconds to wait for the CLI to print the URL
CODE_WAIT = 15 * 60        # how long a login link stays usable
EXCHANGE_WAIT = 60         # seconds for the CLI to exchange the code


def is_auth_error(error: str | None = None, text: str | None = None) -> bool:
    """True for a failed run caused by a missing/expired subscription login.
    Only pass error text here, never a normal model reply."""
    return error in AUTH_ERRORS or bool(text and _AUTH_TEXT.search(text))


def clean_env() -> dict:
    env = os.environ.copy()
    for var in API_KEY_VARS:
        env.pop(var, None)
    return env


def _creds_mtime() -> float:
    try:
        return CREDENTIALS.stat().st_mtime
    except OSError:
        return 0.0


class LoginFlow:
    """One pending `claude auth login` per bot process.

    `send(chat_id, html_text)` delivers a Telegram HTML message.
    """

    def __init__(self, claude_bin: str, send: Callable[[int, str], None]):
        self.claude_bin = claude_bin
        self.send = send
        self._lock = threading.Lock()
        self.proc: subprocess.Popen | None = None
        self.url: str | None = None
        self.started = 0.0
        self.chats: set[int] = set()
        self._out: list[str] = []

    # -- state ------------------------------------------------------------- #
    def pending(self) -> bool:
        with self._lock:
            return self._pending_locked()

    def _pending_locked(self) -> bool:
        if self.proc is None:
            return False
        if self.proc.poll() is not None or time.time() - self.started > CODE_WAIT:
            self._reset_locked()
            return False
        return True

    def _reset_locked(self) -> None:
        p = self.proc
        if p and p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                pass
        self.proc, self.url, self.started = None, None, 0.0
        self.chats = set()
        self._out = []

    def logged_in_elsewhere(self) -> bool:
        """The credentials were rewritten after this flow began (e.g. the other
        bot or a manual `claude /login`) and the CLI reports a login."""
        if not self.started or _creds_mtime() <= self.started:
            return False
        try:
            p = subprocess.run([self.claude_bin, "auth", "status"], env=clean_env(),
                               capture_output=True, text=True, timeout=20)
            return bool(json.loads(p.stdout).get("loggedIn"))
        except Exception:
            return False

    # -- flow -------------------------------------------------------------- #
    def _message(self) -> str:
        url = html.escape(self.url or "", quote=True)
        return (
            "🔑 <b>Abonamentul Claude nu mai e conectat</b>\n"
            "Login ca în terminal:\n"
            f"1. Deschide <a href=\"{url}\">linkul de autentificare</a>\n"
            "2. Autorizează contul cu abonamentul\n"
            "3. Trimite-mi aici <b>codul</b> afișat la final\n\n"
            f"<i>Linkul e valabil {CODE_WAIT // 60} minute. /login — link nou.</i>\n\n"
            f"<code>{html.escape(self.url or '', quote=False)}</code>"
        )

    def begin(self, chat_id: int, force_new: bool = False) -> None:
        """Start a login (or re-send the pending link) and message `chat_id`."""
        with self._lock:
            if force_new:
                self._reset_locked()
            if self._pending_locked():
                self.chats.add(chat_id)
                msg = self._message()
            else:
                msg = self._start_locked(chat_id)
        self.send(chat_id, msg)

    def _start_locked(self, chat_id: int) -> str:
        try:
            proc = subprocess.Popen(
                [self.claude_bin, "auth", "login", "--claudeai"],
                env={**clean_env(), "BROWSER": "/bin/false"},
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1, start_new_session=True,
            )
        except Exception as e:
            log.exception("Could not start claude auth login")
            return f"❌ Nu pot porni <code>claude auth login</code>: {html.escape(str(e))}"

        out: list[str] = []
        got_url = threading.Event()

        def reader() -> None:
            for line in proc.stdout:
                out.append(line)
                if _URL.search(line):
                    got_url.set()
            got_url.set()  # EOF — stop waiting

        threading.Thread(target=reader, name="claude-login", daemon=True).start()
        got_url.wait(URL_WAIT)
        m = _URL.search("".join(out))
        if not m:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except Exception:
                pass
            tail = html.escape("".join(out).strip()[-500:] or "(fără output)")
            return f"❌ <code>claude auth login</code> nu a dat un link:\n<code>{tail}</code>"

        self.proc, self.url, self.started = proc, m.group(0), time.time()
        self.chats = {chat_id}
        self._out = out
        log.info("Claude login flow started for chat %s", chat_id)
        return self._message()

    def handle_text(self, chat_id: int, text: str) -> bool:
        """Call for every authorized message while a login may be pending.
        Returns True if the message was consumed by the login flow."""
        if not self.pending():
            return False
        if self.logged_in_elsewhere():
            with self._lock:
                self._reset_locked()
            log.info("Claude login completed elsewhere — dropping pending flow")
            return False
        token = text.strip()
        if not _CODE.match(token):
            if token.lower().startswith("/login"):
                return False  # let the bot's /login handler issue a fresh link
            self.send(chat_id, "⏳ Aștept codul de login Claude. " + self._message())
            return True
        threading.Thread(target=self._submit, args=(chat_id, token),
                         name="claude-login-code", daemon=True).start()
        return True

    def _submit(self, chat_id: int, code: str) -> None:
        with self._lock:
            proc, out, chats = self.proc, self._out, set(self.chats) | {chat_id}
        if proc is None:
            return
        self.send(chat_id, "🔄 Verific codul…")
        try:
            proc.stdin.write(code + "\n")
            proc.stdin.flush()
            proc.wait(EXCHANGE_WAIT)
            ok = proc.returncode == 0
        except Exception:
            log.exception("Login code exchange failed")
            ok = False
        with self._lock:
            if self.proc is proc:
                self._reset_locked()
        tail = re.split(r"Paste code here[^>]*>", "".join(out))[-1].strip()[-400:]
        if ok:
            log.info("Claude subscription login OK (chat %s)", chat_id)
            msg = "✅ <b>Conectat din nou la abonamentul Claude.</b> Retrimite mesajul."
        else:
            log.warning("Claude login failed: %s", tail)
            msg = ("❌ <b>Login eșuat.</b> "
                   + (f"<code>{html.escape(tail)}</code>\n" if tail else "")
                   + "Trimite /login pentru un link nou.")
        for cid in chats:
            self.send(cid, msg)
