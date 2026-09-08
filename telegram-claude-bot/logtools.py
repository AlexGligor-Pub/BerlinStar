"""Read-only log-inspection tools exposed to Claude.

Everything here is strictly read-only and hardened against shell injection
(no shell=True; all subprocess calls use argument lists) and path traversal
(realpath must resolve inside an allow-listed directory).
"""
from __future__ import annotations

import gzip
import os
import subprocess
from pathlib import Path

# Directories the bot is allowed to read log files from.
ALLOWED_LOG_DIRS = [
    "/var/log",
    "/root/BerlinStar/backend/logs",
    "/root/BerlinStar/telegram-claude-bot",
]

CMD_TIMEOUT = 30          # seconds per subprocess call
MAX_LINES = 2000          # hard cap on requested lines
OUTPUT_MAX = 7000         # chars returned to the model (keeps the tail)


def _cap_lines(n, default=100):
    try:
        n = int(n)
    except (TypeError, ValueError):
        return default
    return max(1, min(n, MAX_LINES))


def _truncate_tail(text: str) -> str:
    """Trim to OUTPUT_MAX chars, keeping the END (newest log lines)."""
    if len(text) <= OUTPUT_MAX:
        return text
    kept = text[-OUTPUT_MAX:]
    return f"…[truncated {len(text) - OUTPUT_MAX} earlier chars]…\n{kept}"


def _run(args: list[str]) -> str:
    try:
        p = subprocess.run(
            args, capture_output=True, text=True, timeout=CMD_TIMEOUT,
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        return f"(command timed out after {CMD_TIMEOUT}s)"
    except FileNotFoundError:
        return f"(command not found: {args[0]})"
    out = p.stdout or ""
    if p.stderr:
        out += ("\n" if out else "") + p.stderr
    if not out.strip():
        out = "(no output)"
    return _truncate_tail(out)


# --------------------------------------------------------------------------- #
# systemd journal
# --------------------------------------------------------------------------- #

def query_journal(lines=100, unit=None, since=None, until=None,
                  priority=None, grep=None, **_):
    args = ["journalctl", "--no-pager", "-n", str(_cap_lines(lines))]
    if unit:
        args += ["-u", str(unit)]
    if since:
        args += ["--since", str(since)]
    if until:
        args += ["--until", str(until)]
    if priority not in (None, ""):
        args += ["-p", str(priority)]
    if grep:
        args += ["-g", str(grep), "--case-sensitive=false"]
    return _run(args)


# --------------------------------------------------------------------------- #
# Docker
# --------------------------------------------------------------------------- #

def _running_containers() -> list[str]:
    try:
        p = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=CMD_TIMEOUT,
        )
        return [n for n in p.stdout.split() if n]
    except Exception:
        return []


def list_containers(**_):
    names = _running_containers()
    return "\n".join(names) if names else "(no running containers / docker unavailable)"


def container_logs(name=None, lines=100, since=None, **_):
    names = _running_containers()
    if not name or name not in names:
        return f"Unknown container '{name}'. Running: {', '.join(names) or '(none)'}"
    args = ["docker", "logs", "--tail", str(_cap_lines(lines))]
    if since:
        args += ["--since", str(since)]
    args.append(name)
    return _run(args)


# --------------------------------------------------------------------------- #
# Log files
# --------------------------------------------------------------------------- #

def _resolve_allowed(path: str) -> Path | None:
    """Return a realpath'd Path only if it lives inside an allowed dir."""
    try:
        rp = Path(path).resolve()
    except Exception:
        return None
    for base in ALLOWED_LOG_DIRS:
        b = Path(base).resolve()
        if rp == b or b in rp.parents:
            # Outside /var/log, only expose *.log* files (not .env, configs, etc.)
            if str(rp).startswith(str(Path("/var/log").resolve())):
                return rp
            if ".log" in rp.name:
                return rp
    return None


def list_log_files(**_):
    out = []
    for base in ALLOWED_LOG_DIRS:
        p = Path(base)
        if not p.is_dir():
            continue
        out.append(f"# {base}")
        try:
            for f in sorted(p.iterdir()):
                if not f.is_file():
                    continue
                if base != "/var/log" and ".log" not in f.name:
                    continue
                try:
                    size = f.stat().st_size
                except OSError:
                    size = 0
                out.append(f"  {f.name} ({size} bytes)")
        except PermissionError:
            out.append("  (permission denied)")
    return "\n".join(out) or "(no readable log files)"


def read_log_file(path=None, lines=100, grep=None, **_):
    if not path:
        return "Provide a 'path' (see list_log_files)."
    rp = _resolve_allowed(path)
    if rp is None:
        return (f"Access denied or not a log file: {path}\n"
                f"Allowed dirs: {', '.join(ALLOWED_LOG_DIRS)} (project dirs: *.log only).")
    if not rp.exists():
        return f"File not found: {rp}"
    n = _cap_lines(lines)
    opener = gzip.open if rp.suffix == ".gz" else open
    try:
        with opener(rp, "rt", errors="replace") as fh:
            all_lines = fh.readlines()
    except Exception as e:
        return f"Could not read {rp}: {e}"
    if grep:
        needle = str(grep).lower()
        all_lines = [ln for ln in all_lines if needle in ln.lower()]
    tail = "".join(all_lines[-n:])
    return _truncate_tail(tail) if tail.strip() else "(no matching lines)"


# --------------------------------------------------------------------------- #
# Tool registry
# --------------------------------------------------------------------------- #

DISPATCH = {
    "query_journal": query_journal,
    "list_containers": list_containers,
    "container_logs": container_logs,
    "list_log_files": list_log_files,
    "read_log_file": read_log_file,
}

TOOLS = [
    {
        "name": "query_journal",
        "description": "Read the systemd journal (journalctl) — services, ssh, kernel, "
                       "auth, etc. Returns the newest matching lines. Read-only.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lines": {"type": "integer", "description": "How many recent lines (default 100, max 2000)."},
                "unit": {"type": "string", "description": "Filter by systemd unit, e.g. 'ssh.service' or 'docker'."},
                "since": {"type": "string", "description": "Start time, e.g. '1 hour ago', 'today', '2026-09-08 07:00'."},
                "until": {"type": "string", "description": "End time (same formats as since)."},
                "priority": {"type": "string", "description": "Max priority 0-7 or name (emerg..debug), e.g. 'err' or '3'."},
                "grep": {"type": "string", "description": "Case-insensitive text/regex filter."},
            },
        },
    },
    {
        "name": "list_containers",
        "description": "List currently running Docker containers by name.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "container_logs",
        "description": "Read recent logs from a running Docker container (by name from list_containers). Read-only.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Container name."},
                "lines": {"type": "integer", "description": "Recent lines (default 100, max 2000)."},
                "since": {"type": "string", "description": "e.g. '10m', '1h', '2026-09-08T07:00:00'."},
            },
            "required": ["name"],
        },
    },
    {
        "name": "list_log_files",
        "description": "List readable log files under the allowed directories "
                       "(/var/log and the BerlinStar app/bot logs).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "read_log_file",
        "description": "Read the tail of a specific log file from the allowed directories "
                       "(supports .gz). Optional case-insensitive grep. Read-only.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Full path from list_log_files, e.g. '/var/log/auth.log'."},
                "lines": {"type": "integer", "description": "Tail size (default 100, max 2000)."},
                "grep": {"type": "string", "description": "Case-insensitive substring filter."},
            },
            "required": ["path"],
        },
    },
]


def run_tool(name: str, tool_input: dict) -> str:
    fn = DISPATCH.get(name)
    if not fn:
        return f"Unknown tool: {name}"
    try:
        return fn(**(tool_input or {}))
    except Exception as e:  # never let a tool crash the loop
        return f"Tool '{name}' error: {e}"
