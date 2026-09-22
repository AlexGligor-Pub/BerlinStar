"""Auto-update productie din branch-ul MainProd.

Flux (acelasi ca in history-ul de pe server, plus verificari si rollback):
  1. git fetch; daca origin/MainProd are commit-uri noi -> git pull (ff sau merge)
  2. backup DB: deploy/backup_Productie_<ts>.sqlplus (pentru git, ca pana acum)
     + /root/db_backups/auto_update_<ts>.dump (format custom, pentru restore)
  3. cd deploy && git add . && git commit -m "backup <zi> <luna>" && git push
  4. agent Claude (Opus 5, auto mode, read/write) citeste instructiunile din
     commit-uri/docs, face update-ul (rebuild, alembic, .env, ...) si verifica
  5. verificari independente: containere healthy, alembic la head, HTTP 200
  6. esec -> mesaj pe Telegram cu situatia + cerere de sfat; un raspuns text de
     la un admin reia agentul cu sfatul; /rollback sau 1h fara raspuns ->
     revenire la starea initiala (cod, .env, DB daca s-a migrat, containere).

Pasii 1-3 nu ating sistemul care ruleaza, asa ca un esec acolo e anulat imediat
(fara asteptare). Starea e persistata in update_state.json, deci o repornire a
botului in timp ce asteapta un sfat continua asteptarea (si termenul de 1h).
"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import shutil
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import urlsplit

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    query,
)

import claude_login

log = logging.getLogger("tg-claude.updater")

# --------------------------------------------------------------------------- #
# Config (din .env; incarcat deja de bot.py)
# --------------------------------------------------------------------------- #

BOT_DIR = Path(__file__).resolve().parent
REPO = Path(os.environ.get("UPDATE_REPO", str(BOT_DIR.parent))).resolve()
DEPLOY = REPO / "deploy"
BRANCH = os.environ.get("UPDATE_BRANCH", "MainProd").strip()
CHECK_MINUTES = int(os.environ.get("UPDATE_CHECK_MINUTES", "15"))  # 0 = doar manual (/update)
ADVICE_TIMEOUT_MIN = int(os.environ.get("UPDATE_ADVICE_TIMEOUT_MIN", "60"))
MODEL = os.environ.get("UPDATE_MODEL", "claude-opus-5").strip()
EFFORT = os.environ.get("UPDATE_EFFORT", "high").strip()
PERMISSION_MODE = os.environ.get("UPDATE_PERMISSION_MODE", "auto").strip()
MAX_TURNS = int(os.environ.get("UPDATE_MAX_TURNS", "250"))
AGENT_TIMEOUT_MIN = int(os.environ.get("UPDATE_AGENT_TIMEOUT_MIN", "90"))
PUSH_TOKEN = os.environ.get("GIT_PUSH_TOKEN", "").strip()
BACKUP_DIR = Path(os.environ.get("UPDATE_BACKUP_DIR", "/root/db_backups"))
KEEP_DUMPS = int(os.environ.get("UPDATE_KEEP_DUMPS", "10"))
BOT_SERVICE = os.environ.get("UPDATE_BOT_SERVICE", "berlinstar-logbot").strip()
HEALTH_URLS = [u.strip() for u in os.environ.get(
    "UPDATE_HEALTH_URLS",
    "http://localhost/api/health,https://professorprime.ro/api/health,"
    "https://professorprime.ro/berlinstar/",
).split(",") if u.strip()]
# Agentul nu are voie la astea (git-ul si repornirea botului le face updater-ul).
DISALLOWED_TOOLS = [
    "Bash(git push:*)", "Bash(git reset:*)", "Bash(git checkout:*)", "Bash(git switch:*)",
    "Bash(git rebase:*)", "Bash(git commit:*)", "Bash(git merge:*)", "Bash(git pull:*)",
    "Bash(git clean:*)", "Bash(git stash:*)",
    "Bash(docker compose down -v:*)", "Bash(docker volume rm:*)", "Bash(docker volume prune:*)",
    "Bash(docker system prune:*)", "Bash(dropdb:*)",
    f"Bash(systemctl restart {BOT_SERVICE}:*)", f"Bash(systemctl stop {BOT_SERVICE}:*)",
    f"Bash(systemctl kill {BOT_SERVICE}:*)", "Bash(reboot:*)", "Bash(shutdown:*)",
]

STATE_FILE = BOT_DIR / "update_state.json"
LUNI = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sept", "oct", "nov", "dec"]
ROLLBACK = object()  # sentinel: rollback cerut explicit

AGENT_SYSTEM_APPEND = f"""
Esti agentul de deploy al productiei BerlinStar (server Hetzner, rulezi ca root).
Repo: {REPO} (branch {BRANCH}); stack-ul Docker Compose e in {DEPLOY}
(servicii: caddy, frontend, backend, db, autoheal).
Codul nou e DEJA tras cu git, iar baza de date e DEJA salvata — nu le repeta.

Reguli stricte:
- NU folosi git pentru a schimba istoricul sau branch-ul (push/reset/checkout/merge/
  commit/stash/clean le face updater-ul). Poti citi liber (git log/diff/show).
- NU sterge volume Docker, NU face `docker compose down -v`, NU sterge/recrea baza de date,
  NU sterge backup-uri.
- NU reporni si NU opri serviciul {BOT_SERVICE} (e chiar procesul care te ruleaza).
- deploy/.env contine secrete: poti ADAUGA chei noi cerute de instructiuni (backup-ul
  e facut deja), dar nu schimba/sterge valori existente fara o instructiune explicita,
  si nu afisa niciodata valori secrete in raport.
- Nu modifica codul aplicatiei ca sa "repari" un build; daca update-ul nu merge,
  explica exact ce ai gasit (erori, loguri) si ce propui — un om decide.
- Comenzile lungi (build --no-cache) pot dura minute: da-le timeout mare (pana la
  600000 ms) sau imparte-le pe servicii.
Raportul final e citit pe telefon in Telegram: scurt, in romana, doar tag-urile
<b>, <i>, <code>, bullet-uri cu '• ', fara tabele si fara blocuri de cod late.
Ultima linie a raspunsului final trebuie sa fie exact `REZULTAT: OK` sau `REZULTAT: ESEC`.
""".strip()


class ClaudeAuthError(RuntimeError):
    """Login-ul abonamentului Claude lipseste sau a expirat."""


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _redact(text: str) -> str:
    if PUSH_TOKEN:
        text = text.replace(PUSH_TOKEN, "***")
    return re.sub(r"github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+", "***", text)


def run(cmd: list[str], cwd: Path = REPO, timeout: int = 300, stdout=None,
        stdin=None) -> tuple[int, str]:
    """Run a command (no shell); return (returncode, output, redacted).

    With `stdout` (an open binary file) the output goes there and the returned
    text is stderr.
    """
    log.info("$ %s", _redact(" ".join(cmd)))
    try:
        p = subprocess.run(cmd, cwd=cwd, timeout=timeout, text=stdout is None,
                           stdout=stdout or subprocess.PIPE,
                           stderr=subprocess.STDOUT if stdout is None else subprocess.PIPE,
                           stdin=stdin)
    except subprocess.TimeoutExpired:
        return 124, f"timeout dupa {timeout}s: {_redact(' '.join(cmd))}"
    except OSError as e:
        return 127, str(e)
    out = p.stdout if stdout is None else (p.stderr or b"").decode(errors="replace")
    return p.returncode, _redact((out or "").strip())


def git(*args: str, timeout: int = 120) -> tuple[int, str]:
    return run(["git", *args], timeout=timeout)


def dc(*args: str, timeout: int = 300, **kw) -> tuple[int, str]:
    return run(["docker", "compose", "-f", "docker-compose.yml", *args],
               cwd=DEPLOY, timeout=timeout, **kw)


def env_get(key: str, default: str = "") -> str:
    try:
        for line in (DEPLOY / ".env").read_text().splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip() or default
    except OSError:
        pass
    return default


def db_user() -> str:
    return env_get("POSTGRES_USER", "berlinstar")


def db_name() -> str:
    return env_get("POSTGRES_DB", "berlinstar")


def psql(sql: str, db: str | None = None) -> tuple[int, str]:
    return dc("exec", "-T", "db", "psql", "-U", db_user(), "-d", db or db_name(),
              "-v", "ON_ERROR_STOP=1", "-tAc", sql, timeout=120)


def alembic_revision() -> str | None:
    rc, out = psql("SELECT string_agg(version_num, ',' ORDER BY version_num) FROM alembic_version")
    return out.strip() if rc == 0 else None


def tail(text: str, n: int = 700) -> str:
    return text if len(text) <= n else "…" + text[-n:]


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def push_url() -> str | None:
    if not PUSH_TOKEN:
        return None
    rc, url = git("remote", "get-url", "origin")
    if rc != 0 or not url.startswith("https://"):
        return None
    parts = urlsplit(url)
    return f"https://{PUSH_TOKEN}@{parts.hostname}{parts.path}"


# --------------------------------------------------------------------------- #
# Updater
# --------------------------------------------------------------------------- #

class Updater:
    def __init__(self, send: Callable[[int, str], None], fmt: Callable[[str], str],
                 notify_chats: Callable[[], Iterable[int]]):
        self._send = send
        self._fmt = fmt
        self._notify_chats = notify_chats
        self._busy = threading.Lock()
        self._advice_lock = threading.Lock()
        self._advice: list = []  # texte de la admini / ROLLBACK
        self._advice_evt = threading.Event()
        self.state: dict = self._load()

    # ----- state -----
    def _load(self) -> dict:
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {"phase": "idle"}

    def _save(self, **changes) -> None:
        self.state.update(changes)
        try:
            tmp = STATE_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.state, indent=2))
            tmp.replace(STATE_FILE)
        except Exception:
            log.exception("Nu pot salva %s", STATE_FILE)

    @property
    def waiting_for_advice(self) -> bool:
        return self.state.get("phase") == "waiting_advice"

    def notify(self, text: str) -> None:
        chats = list(self._notify_chats())
        if not chats:
            log.warning("Update: niciun chat de notificat: %s", text[:200])
        for chat_id in chats:
            self._send(chat_id, text)

    # ----- public API (apelat din bot.py) -----
    def start(self) -> None:
        """Porneste bucla de verificare + reia un update intrerupt de o repornire."""
        if self.state.get("phase", "idle") != "idle":
            threading.Thread(target=self._resume_after_restart, name="updater-resume",
                             daemon=True).start()
        if CHECK_MINUTES > 0:
            threading.Thread(target=self._loop, name="updater", daemon=True).start()
        log.info("Updater: branch %s, verificare %s, model %s (%s mode)", BRANCH,
                 f"la {CHECK_MINUTES} min" if CHECK_MINUTES > 0 else "doar /update",
                 MODEL, PERMISSION_MODE)

    def trigger(self, force: bool = False) -> str:
        if self._busy.locked() or self.state.get("phase", "idle") != "idle":
            return "⏳ Un update e deja în curs. /updatestatus pentru detalii."
        threading.Thread(target=self.check_and_update, kwargs={"force": force, "manual": True},
                         name="updater-manual", daemon=True).start()
        return "🔎 Verific MainProd…"

    def provide_advice(self, text: str, who: str) -> None:
        with self._advice_lock:
            self._advice.append(f"{text}\n(— {who})")
        self._advice_evt.set()

    def request_rollback(self) -> bool:
        if not self.waiting_for_advice:
            return False
        with self._advice_lock:
            self._advice.append(ROLLBACK)
        self._advice_evt.set()
        return True

    def status_text(self) -> str:
        s = self.state
        lines = [f"<b>Auto-update</b> ({esc(BRANCH)})",
                 f"• Stare: {esc(s.get('phase', 'idle'))}",
                 "• Verificare: " + (f"la {CHECK_MINUTES} min" if CHECK_MINUTES > 0 else "doar /update"),
                 f"• Agent: {esc(MODEL)} · {esc(PERMISSION_MODE)} mode"]
        if s.get("last_check"):
            lines.append(f"• Ultima verificare: {esc(s['last_check'])}")
        if s.get("last_result"):
            lines.append(f"• Ultimul rezultat: {esc(s['last_result'])}")
        if s.get("skip_remote_sha"):
            lines.append(f"• Sar peste <code>{s['skip_remote_sha'][:8]}</code> "
                         "(a eșuat; /update force reîncearcă)")
        if self.waiting_for_advice and s.get("deadline"):
            left = max(0, int((s["deadline"] - time.time()) / 60))
            lines.append(f"• Aștept sfat încă ~{left} min, apoi rollback")
        return "\n".join(lines)

    # ----- loop -----
    def _loop(self) -> None:
        time.sleep(60)  # lasa botul sa porneasca
        while True:
            if self.state.get("phase", "idle") == "idle" and not self._busy.locked():
                try:
                    self.check_and_update()
                except Exception:
                    log.exception("Updater loop error")
            time.sleep(CHECK_MINUTES * 60)

    # ----- flux principal -----
    def check_and_update(self, force: bool = False, manual: bool = False) -> None:
        if not self._busy.acquire(blocking=False):
            return
        try:
            self._check_and_update(force, manual)
        except Exception as e:
            log.exception("Update error")
            if self.state.get("phase") == "updating":
                self._failure_flow(f"Eroare neașteptată în updater: {esc(str(e))}", None)
            else:
                self.notify(f"❌ <b>Auto-update:</b> eroare neașteptată: "
                            f"<code>{esc(tail(str(e), 300))}</code>")
        finally:
            self._busy.release()

    def _check_and_update(self, force: bool, manual: bool) -> None:
        self._save(last_check=datetime.now().strftime("%Y-%m-%d %H:%M"))
        rc, branch = git("rev-parse", "--abbrev-ref", "HEAD")
        if rc != 0 or branch != BRANCH:
            self._warn_once("branch", branch,
                            f"⚠️ <b>Auto-update oprit:</b> repo-ul e pe <code>{esc(branch)}</code>, "
                            f"nu pe <code>{BRANCH}</code>. Nu fac nimic până nu revine pe {BRANCH}.",
                            manual)
            return
        rc, dirty = git("status", "--porcelain", "--untracked-files=no")
        if rc != 0 or dirty:
            self._warn_once("dirty", dirty,
                            "⚠️ <b>Auto-update oprit:</b> sunt modificări necomise în fișiere urmărite:\n"
                            f"<code>{esc(tail(dirty, 400))}</code>", manual)
            return
        rc, out = git("fetch", "origin", BRANCH, timeout=180)
        if rc != 0:
            self._warn_once("fetch", out[:80], "⚠️ <b>Auto-update:</b> git fetch a eșuat:\n"
                            f"<code>{esc(tail(out, 400))}</code>", manual)
            return
        self._save(warned={})
        remote = git("rev-parse", f"origin/{BRANCH}")[1]
        behind = int(git("rev-list", "--count", f"HEAD..origin/{BRANCH}")[1] or 0)
        if behind == 0:
            if manual:
                self.notify("✅ MainProd e la zi, nimic de actualizat.")
            return
        if remote == self.state.get("skip_remote_sha") and not force:
            if manual:
                self.notify(f"⏭ <code>{remote[:8]}</code> a eșuat deja; /update force ca să reîncerc.")
            return
        self._update(remote)

    def _warn_once(self, kind: str, key: str, text: str, manual: bool) -> None:
        warned = self.state.get("warned", {})
        if manual or warned.get(kind) != key:
            self.notify(text)
            self._save(warned={**warned, kind: key})

    def _update(self, remote: str) -> None:
        pre = git("rev-parse", "HEAD")[1]
        _, commits = git("log", "--oneline", "--no-decorate", f"HEAD..origin/{BRANCH}")
        commit_list = commits.splitlines()
        shown = "\n".join(f"• {esc(c)}" for c in commit_list[:10])
        more = f"\n• … încă {len(commit_list) - 10}" if len(commit_list) > 10 else ""
        self.notify(f"🔄 <b>Update pe {BRANCH}</b>: {len(commit_list)} commit-uri noi "
                    f"(<code>{pre[:8]}</code> → <code>{remote[:8]}</code>)\n{shown}{more}\n\n"
                    f"Fac pull, backup DB, commit+push, apoi update cu {esc(MODEL)}.")
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._save(phase="updating", pre_sha=pre, remote_sha=remote, ts=ts,
                   started_at=time.time(), session_id=None, alembic_before=alembic_revision(),
                   backup_dump=None, env_backup=None, skip_candidate=None, deadline=None)

        # 1. pull (ff daca se poate, altfel merge ca un `git pull` normal)
        rc, out = git("merge", "--ff-only", f"origin/{BRANCH}")
        if rc != 0:
            rc, out = git("merge", "--no-edit", f"origin/{BRANCH}")
            if rc != 0:
                git("merge", "--abort")
                return self._abort_early("git pull a eșuat (conflict la merge)", out, pre)
        new = git("rev-parse", "HEAD")[1]

        # 2. backup DB
        sql_file = DEPLOY / f"backup_Productie_{ts}.sqlplus"
        with open(sql_file, "wb") as f:
            rc, err = dc("exec", "-T", "db", "pg_dump", "-U", db_user(), db_name(),
                         timeout=1800, stdout=f)
        if rc != 0 or sql_file.stat().st_size < 1024:
            sql_file.unlink(missing_ok=True)
            return self._abort_early("backup-ul bazei de date (pg_dump) a eșuat", err, pre)
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        dump_file = BACKUP_DIR / f"auto_update_{ts}.dump"
        with open(dump_file, "wb") as f:
            rc, err = dc("exec", "-T", "db", "pg_dump", "-Fc", "-U", db_user(), db_name(),
                         timeout=1800, stdout=f)
        if rc != 0 or dump_file.stat().st_size < 1024:
            dump_file.unlink(missing_ok=True)
            sql_file.unlink(missing_ok=True)
            return self._abort_early("backup-ul bazei de date (pg_dump -Fc) a eșuat", err, pre)
        self._save(backup_dump=str(dump_file))
        self._prune_dumps()

        # 3. commit + push (ca in history: din deploy/, `git add .`)
        now = datetime.now()
        msg = f"backup {now.day} {LUNI[now.month - 1]} (auto-update {new[:8]})"
        run(["git", "add", "."], cwd=DEPLOY)
        rc, out = run(["git", "commit", "-m", msg], cwd=DEPLOY)
        if rc != 0:
            sql_file.unlink(missing_ok=True)
            return self._abort_early("git commit a eșuat", out, pre)
        rc, out = git("push", push_url() or "origin", f"HEAD:{BRANCH}", timeout=600)
        push_note = "push OK" if rc == 0 else f"⚠️ push eșuat: <code>{esc(tail(out, 250))}</code>"
        if rc == 0:
            git("fetch", "origin", BRANCH, timeout=180)
        self._save(skip_candidate=git("rev-parse", f"origin/{BRANCH}")[1])

        # 4. backup .env (agentul poate adauga chei)
        env_backup = DEPLOY / f".env.bak_autoupdate_{ts}"
        shutil.copy2(DEPLOY / ".env", env_backup)
        self._save(env_backup=str(env_backup))
        self.notify(f"💾 Backup: <code>{sql_file.name}</code> + <code>{dump_file}</code>\n"
                    f"📝 Commit <i>{esc(msg)}</i> · {push_note}\n"
                    f"🤖 Pornesc agentul de update ({esc(MODEL)}, {esc(PERMISSION_MODE)} mode)…")

        # 5. agent + verificari
        ok, report = self._agent(self._first_prompt(pre, new))
        self._conclude(ok, report)

    def _conclude(self, agent_ok: bool, report: str) -> None:
        checks_ok, checks = self.verify()
        if agent_ok and checks_ok:
            return self._success(report, checks)
        self._failure_flow(report, checks)

    def _abort_early(self, what: str, out: str, pre: str) -> None:
        """Esec inainte sa fie atins sistemul care ruleaza: revino imediat."""
        git("reset", "--hard", pre)
        self._save(phase="idle", skip_remote_sha=self.state.get("remote_sha"),
                   last_result=f"anulat: {what}")
        self.notify(f"❌ <b>Auto-update anulat:</b> {esc(what)}.\n<code>{esc(tail(out, 500))}</code>\n\n"
                    f"Codul e înapoi la <code>{pre[:8]}</code>, aplicația n-a fost atinsă. "
                    "Nu reîncerc acest commit până nu apare altul nou (/update force = acum).")

    def _success(self, report: str, checks: list[str]) -> None:
        pre, new = self.state.get("pre_sha", ""), git("rev-parse", "HEAD")[1]
        mins = int((time.time() - self.state.get("started_at", time.time())) / 60)
        self._save(phase="idle", skip_remote_sha=None, deadline=None,
                   last_result=f"OK {new[:8]} ({datetime.now():%Y-%m-%d %H:%M})")
        self.notify(f"✅ <b>Update reușit</b> în ~{mins} min (<code>{pre[:8]}</code> → "
                    f"<code>{new[:8]}</code>)\n\n{self._fmt(report)}\n\n<b>Verificări</b>\n"
                    + "\n".join(checks))
        if pre:
            self._restart_bot_if_changed(pre, new)

    # ----- esec: cere sfat, asteapta, rollback -----
    def _failure_flow(self, report: str, checks: list[str] | None) -> None:
        while True:
            self._save(phase="waiting_advice", deadline=time.time() + ADVICE_TIMEOUT_MIN * 60)
            with self._advice_lock:
                self._advice.clear()
                self._advice_evt.clear()
            check_txt = ("\n\n<b>Verificări</b>\n" + "\n".join(checks)) if checks else ""
            self.notify(f"🚨 <b>Probleme la update-ul producției</b> "
                        f"(<code>{self.state.get('pre_sha', '')[:8]}</code> → "
                        f"<code>{git('rev-parse', 'HEAD')[1][:8]}</code>)\n\n"
                        f"{self._fmt(report)}{check_txt}\n\n"
                        "❓ <b>Am nevoie de un sfat.</b> Răspunde aici cu ce să încerc "
                        "(orice mesaj text de la un admin îl trimit agentului).\n"
                        "/rollback — revin acum la starea inițială\n"
                        f"Dacă nu răspunde nimeni în {ADVICE_TIMEOUT_MIN} min, fac rollback automat.")
            answer = self._wait_advice()
            if answer is None:
                self.notify(f"⌛ Niciun răspuns în {ADVICE_TIMEOUT_MIN} min — fac rollback.")
                return self.rollback()
            if answer is ROLLBACK:
                return self.rollback()
            self._save(phase="updating", deadline=None)
            self.notify(f"🤖 Am primit sfatul, reiau cu {esc(MODEL)}…")
            ok, report = self._agent(self._advice_prompt(answer),
                                     resume=self.state.get("session_id"))
            checks_ok, checks = self.verify()
            if ok and checks_ok:
                return self._success(report, checks)

    @staticmethod
    def _advice_prompt(advice: str) -> str:
        return ("Un administrator a răspuns la raportul tău de eșec cu sfatul de mai jos. "
                "Aplică-l (respectând regulile), apoi verifică din nou că totul e funcțional "
                "și raportează în același format, terminând cu REZULTAT: OK sau REZULTAT: ESEC.\n\n"
                f"SFAT:\n{advice}")

    def _wait_advice(self):
        while True:
            remaining = (self.state.get("deadline") or 0) - time.time()
            if remaining <= 0:
                return None
            self._advice_evt.wait(min(remaining, 30))
            with self._advice_lock:
                self._advice_evt.clear()
                if not self._advice:
                    continue
                if ROLLBACK in self._advice:
                    self._advice.clear()
                    return ROLLBACK
                items, self._advice = self._advice, []
            return "\n\n".join(items)

    def _resume_after_restart(self) -> None:
        """Botul a repornit in mijlocul unui update."""
        with self._busy:
            phase = self.state.get("phase")
            if phase == "waiting_advice" and self.state.get("deadline"):
                log.info("Updater: reiau asteptarea sfatului dupa repornire")
                self.notify("♻️ Botul a repornit; încă aștept un sfat pentru update-ul eșuat "
                            "(sau /rollback).")
                answer = self._wait_advice()
                if answer is None:
                    self.notify(f"⌛ Niciun răspuns în {ADVICE_TIMEOUT_MIN} min — fac rollback.")
                    return self.rollback()
                if answer is ROLLBACK:
                    return self.rollback()
                self._save(phase="updating", deadline=None)
                ok, report = self._agent(self._advice_prompt(answer),
                                         resume=self.state.get("session_id"))
                return self._conclude(ok, report)
            if phase == "rolling_back":
                self.notify("♻️ Botul a repornit în timpul rollback-ului — îl reiau.")
                return self.rollback()
            self._failure_flow("Botul a repornit în mijlocul update-ului; nu știu dacă "
                               "agentul a terminat.", self.verify()[1])

    # ----- rollback -----
    def rollback(self) -> None:
        s = self.state
        self._save(phase="rolling_back", deadline=None)
        pre = s.get("pre_sha")
        cur = git("rev-parse", "HEAD")[1]
        notes: list[str] = []
        self.notify(f"⏪ <b>Rollback</b> la <code>{(pre or '?')[:8]}</code>…")

        # cod
        git("merge", "--abort")
        rc, out = git("reset", "--hard", pre) if pre else (1, "lipsește pre_sha")
        notes.append("• cod: " + ("OK" if rc == 0 else f"❌ <code>{esc(tail(out, 200))}</code>"))

        # .env
        env_backup = s.get("env_backup")
        if env_backup and Path(env_backup).exists():
            if Path(env_backup).read_bytes() != (DEPLOY / ".env").read_bytes():
                shutil.copy2(env_backup, DEPLOY / ".env")
                notes.append("• deploy/.env: restaurat")
            else:
                notes.append("• deploy/.env: neschimbat")

        # DB — doar daca migrarile au schimbat schema (altfel s-ar pierde date reale degeaba)
        before, now_rev = s.get("alembic_before"), alembic_revision()
        dump = s.get("backup_dump")
        if before and now_rev and before != now_rev and dump and Path(dump).exists():
            notes.append(self._restore_db(dump, s.get("ts") or datetime.now().strftime("%Y%m%d_%H%M%S")))
        elif before and before == now_rev:
            notes.append(f"• DB: schema neschimbată (alembic <code>{esc(before)}</code>), n-am restaurat")
        else:
            notes.append(f"• DB: ⚠️ nu pot compara alembic ({esc(str(before))} → {esc(str(now_rev))}); "
                         f"n-am restaurat. Backup: <code>{esc(str(dump))}</code>")

        # containere pe codul vechi
        rc, out = dc("build", "--no-cache", timeout=3600)
        if rc == 0:
            rc, out = dc("up", "-d", "--remove-orphans", timeout=900)
        notes.append("• rebuild + up: " + ("OK" if rc == 0 else f"❌ <code>{esc(tail(out, 300))}</code>"))

        ok, checks = self.verify()
        skip = s.get("skip_candidate") or s.get("remote_sha")
        self._save(phase="idle", skip_remote_sha=skip,
                   last_result=f"rollback {'OK' if ok else 'cu probleme'} ({datetime.now():%Y-%m-%d %H:%M})")
        self.notify(("✅" if ok else "🚨") + f" <b>Rollback {'terminat' if ok else 'cu probleme'}</b>\n"
                    + "\n".join(notes) + "\n\n<b>Verificări</b>\n" + "\n".join(checks)
                    + f"\n\nNu reîncerc <code>{(skip or '?')[:8]}</code> până nu apare un commit nou "
                      "pe MainProd (/update force = acum)."
                    + ("" if ok else "\n❗ Sistemul NU e complet funcțional — e nevoie de intervenție manuală."))
        if pre:
            self._restart_bot_if_changed(cur, pre)

    def _restore_db(self, dump: str, ts: str) -> str:
        """Pastreaza DB-ul migrat sub alt nume si restaureaza backup-ul intr-un DB nou."""
        user, name = db_user(), db_name()
        failed_name = f"{name}_failed_{ts}"
        dc("stop", "backend", timeout=300)
        steps = [
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname='{name}' AND pid <> pg_backend_pid()",
            f'ALTER DATABASE "{name}" RENAME TO "{failed_name}"',
            f'CREATE DATABASE "{name}" OWNER "{user}"',
        ]
        for sql in steps:
            rc, out = psql(sql, db="postgres")
            if rc != 0:
                return (f"• DB: ❌ restore oprit la <code>{esc(sql[:60])}</code>: "
                        f"<code>{esc(tail(out, 200))}</code>")
        with open(dump, "rb") as f:
            rc, out = dc("exec", "-T", "db", "pg_restore", "-U", user, "-d", name, "--no-owner",
                         f"--role={user}", timeout=3600, stdin=f)
        rev = alembic_revision()
        status = "OK" if rc == 0 else f"⚠️ cu avertismente (<code>{esc(tail(out, 200))}</code>)"
        return (f"• DB: restaurat din <code>{esc(Path(dump).name)}</code> — {status}; alembic "
                f"<code>{esc(str(rev))}</code>. DB-ul migrat e păstrat ca <code>{failed_name}</code>")

    # ----- verificari independente -----
    def verify(self) -> tuple[bool, list[str]]:
        lines: list[str] = []
        ok = True
        # containere: asteapta pana ies din "starting" (max ~4 min)
        states: list[tuple[str, ...]] = []
        for _ in range(48):
            rc, out = dc("ps", "-a", "--format", "{{.Service}}\t{{.State}}\t{{.Health}}", timeout=60)
            states = [tuple((ln.split("\t") + ["", ""])[:3]) for ln in out.splitlines() if ln.strip()]
            if rc == 0 and states and not any(h == "starting" for _, _, h in states):
                break
            time.sleep(5)
        # Un container al unui serviciu scos din compose (ex. radar, dupa un `up`
        # fara --remove-orphans) nu conteaza la sanatate, dar se semnaleaza.
        _, cfg = dc("config", "--services", timeout=60)
        known = {ln.strip() for ln in cfg.splitlines() if ln.strip()}
        orphans = sorted({svc for svc, _, _ in states if known and svc not in known})
        states = [s for s in states if not known or s[0] in known]
        bad = [f"{svc} ({st}{'/' + h if h else ''})" for svc, st, h in states
               if st != "running" or h not in ("", "healthy")]
        if not states:
            ok = False
            lines.append("• containere: ❌ nu pot citi starea")
        elif bad:
            ok = False
            lines.append(f"• containere: ❌ {esc(', '.join(bad))}")
        else:
            lines.append(f"• containere: ✅ {len(states)} running/healthy")
        if orphans:
            lines.append(f"• ⚠️ containere în afara compose-ului: {esc(', '.join(orphans))} "
                         "(<code>docker compose up -d --remove-orphans</code>)")
        # alembic la head
        rev = alembic_revision()
        _, heads = dc("exec", "-T", "backend", "alembic", "heads", timeout=120)
        head_ids = sorted(re.findall(r"^(\S+) \(head\)", heads, re.M))
        if rev and head_ids and sorted(rev.split(",")) == head_ids:
            lines.append(f"• alembic: ✅ la head (<code>{esc(rev)}</code>)")
        else:
            ok = False
            lines.append(f"• alembic: ❌ DB <code>{esc(str(rev))}</code> vs head "
                         f"<code>{esc(','.join(head_ids) or tail(heads, 100))}</code>")
        # HTTP
        for url in HEALTH_URLS:
            _, code = run(["curl", "-s", "-o", "/dev/null", "-m", "15", "-w", "%{http_code}", url],
                          timeout=30)
            good = code == "200"
            ok = ok and good
            lines.append(f"• {esc(url)} → {'✅' if good else '❌'} {esc(code or 'fără răspuns')}")
        return ok, lines

    # ----- agent -----
    def _first_prompt(self, pre: str, new: str) -> str:
        _, log_txt = git("log", "--no-decorate", "--format=--- %h %an %ad%n%B", "--date=short",
                         f"{pre}..{new}")
        _, stat = git("diff", "--stat=160", f"{pre}..{new}")
        _, names = git("diff", "--name-only", f"{pre}..{new}")
        files = names.splitlines()
        instr = [f for f in files if re.search(
            r"(\.md$|README|UPDATE|MIGRAT|DEPLOY|INSTRUC|CHANGELOG|RELEASE|\.env\.example$|deploy/)", f, re.I)]
        migrations = [f for f in files if "alembic/versions/" in f or "/migrations/" in f]
        return f"""Update de productie: {BRANCH} a fost tras de la {pre[:10]} la {new[:10]} (deja pull-uit),
baza de date e salvata ({self.state.get('backup_dump')}), iar deploy/.env are backup
({self.state.get('env_backup')}). Revizia alembic curenta in DB: {self.state.get('alembic_before')}.

COMMIT-URI NOI:
{tail(log_txt, 6000)}

FISIERE SCHIMBATE:
{tail(stat, 5000)}

Posibile instructiuni / fisiere de deploy schimbate: {', '.join(instr) or '(niciunul)'}
Migrari noi: {', '.join(migrations) or '(niciuna)'}

Ce ai de facut:
1. Citeste instructiunile de update pentru aceste modificari: mesajele commit-urilor,
   fisierele .md schimbate (docs/, README-uri, deploy/README.md), deploy/.env.example
   (chei noi care lipsesc din deploy/.env), orice UPDATE/MIGRATION notes, scripturile
   din deploy/ si deploy-prod.sh (acolo REPO={REPO}; nu-l rula, face git pull — ai deja codul).
2. Aplica pasii necesari (chei noi in .env, pasi manuali ceruti, backfill-uri etc.).
3. Update-ul standard al sistemului (cum se face pe server):
   cd {DEPLOY} && docker compose build --no-cache && docker compose up -d --remove-orphans
   Alembic ruleaza automat la pornirea backend-ului (entrypoint.sh: alembic upgrade head);
   verifica `docker compose exec -T backend alembic current` si `alembic heads`, iar daca
   nu e la head ruleaza `docker compose exec -T backend alembic upgrade head` si investigheaza.
   Daca s-a schimbat ops/agent-bridge: pip install -r ops/agent-bridge/requirements.txt in
   /root/agent-bridge-venv si `systemctl --user restart berlinstar-agent-bridge`.
   Daca s-a schimbat telegram-claude-bot/requirements.txt: instaleaza in .venv-ul botului
   (NU reporni botul — updater-ul il reporneste singur la final).
4. Asigura-te ca totul e functional: toate containerele running/healthy, logurile backend
   fara erori noi dupa pornire, HTTP 200 pe {', '.join(HEALTH_URLS)}, plus orice
   verificare ceruta de instructiuni.
5. Raport final scurt (ce instructiuni ai gasit, ce ai facut, rezultatul verificarilor),
   ultima linie `REZULTAT: OK` sau `REZULTAT: ESEC`."""

    def _agent(self, prompt: str, resume: str | None = None) -> tuple[bool, str]:
        try:
            text = asyncio.run(self._agent_async(prompt, resume))
        except ClaudeAuthError as e:
            return False, (f"Login-ul Claude a expirat ({esc(str(e))}). Trimite /login, finalizează "
                           "autentificarea, apoi răspunde aici „reîncearcă”.")
        except Exception as e:
            log.exception("Agent update error")
            return False, f"Agentul de update a eșuat: {esc(str(e))}"
        m = re.search(r"REZULTAT:\s*(OK|ESEC|EȘEC)\W*$", text.strip(), re.I)
        ok = bool(m) and m.group(1).upper() == "OK"
        report = re.sub(r"\s*REZULTAT:\s*\S+\W*$", "", text.strip()) or "(raport gol)"
        if not m:
            report += "\n(agentul nu a dat verdictul REZULTAT: OK/ESEC)"
        return ok, report

    async def _agent_async(self, prompt: str, resume: str | None) -> str:
        opts = ClaudeAgentOptions(
            model=MODEL,
            effort=EFFORT or None,
            permission_mode=PERMISSION_MODE,
            tools={"type": "preset", "preset": "claude_code"},  # read/write: Bash, Read, Edit, Write…
            system_prompt={"type": "preset", "preset": "claude_code", "append": AGENT_SYSTEM_APPEND},
            disallowed_tools=DISALLOWED_TOOLS,
            setting_sources=[],
            cwd=str(REPO),
            max_turns=MAX_TURNS,
            resume=resume,
        )
        texts: list[str] = []
        error = None

        async def consume() -> None:
            nonlocal texts, error
            async for message in query(prompt=prompt, options=opts):
                if isinstance(message, AssistantMessage):
                    error = message.error or error
                    for b in message.content:
                        if isinstance(b, ToolUseBlock):
                            log.info("update-agent %s %s", b.name, _redact(json.dumps(b.input)[:300]))
                    parts = [b.text for b in message.content if isinstance(b, TextBlock)]
                    if parts:
                        texts = parts
                elif isinstance(message, ResultMessage):
                    if message.session_id:
                        self._save(session_id=message.session_id)
                    if message.is_error:
                        if claude_login.is_auth_error(error, message.result):
                            raise ClaudeAuthError(message.result or error)
                        raise RuntimeError(message.result or message.subtype)
                    if message.result:
                        texts = [message.result]

        try:
            await asyncio.wait_for(consume(), timeout=AGENT_TIMEOUT_MIN * 60)
        except asyncio.TimeoutError:
            raise RuntimeError(f"agentul nu a terminat în {AGENT_TIMEOUT_MIN} min") from None
        return "".join(texts).strip()

    # ----- diverse -----
    def _prune_dumps(self) -> None:
        if KEEP_DUMPS <= 0:
            return
        for old in sorted(BACKUP_DIR.glob("auto_update_*.dump"))[:-KEEP_DUMPS]:
            old.unlink(missing_ok=True)

    def _restart_bot_if_changed(self, a: str, b: str) -> None:
        paths = [p.relative_to(REPO).as_posix() for p in (BOT_DIR, BOT_DIR.parent / "telegram-common")]
        rc, out = git("diff", "--name-only", a, b, "--", *paths)
        if rc == 0 and out.strip():
            self.notify("♻️ Codul botului s-a schimbat — repornesc botul.")
            subprocess.Popen(["systemctl", "restart", "--no-block", BOT_SERVICE])
