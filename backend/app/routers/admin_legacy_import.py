"""Admin-only endpoint: import a legacy BerlinV3 (SQL Server) dump as a new
Account.

Wraps `scripts.import_legacy_vulcanizare.run_import()` behind a multipart
upload endpoint guarded by the super-admin dependency.

Encoding detection: SSMS exports UTF-16 LE by default (BOM \\xff\\xfe). If
detected, we transcode to UTF-8 on the fly before invoking the parser.
"""
from __future__ import annotations

import logging
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.models.account import Account
from app.routers.admin import _require_super_admin
from scripts.import_legacy_vulcanizare import UsernameExists, run_import

log = logging.getLogger("berlinstar")

router = APIRouter()


# Limit accepted dump size — 500 MB is enough headroom for SSMS exports of
# multi-year tire-shop archives (the Vulcanizare DEVA dump was ~200 MB raw).
MAX_DUMP_BYTES = 500 * 1024 * 1024

CHUNK_BYTES = 4 * 1024 * 1024  # 4 MB write chunks


@router.post("/import")
async def import_legacy_dump(
    dump: UploadFile = File(...),
    username: str = Form(...),
    password: str = Form(...),
    account_name: str = Form(...),
    dry_run: bool = Form(False),
    _admin: Account = Depends(_require_super_admin),
) -> dict:
    """Upload an SSMS dump and import as a new Account.

    The dump file is written chunk-by-chunk to `/tmp` (no RAM bloat), the
    UTF-16 LE BOM is auto-detected and transcoded to UTF-8, then the existing
    import orchestrator runs the whole pipeline. Returns the structured
    report from `run_import()`.
    """
    username = (username or "").strip()
    account_name = (account_name or "").strip()
    if not username or not password or not account_name:
        raise HTTPException(400, "username, password si account_name sunt obligatorii.")

    tmp_dir = Path(tempfile.gettempdir())
    raw_path = tmp_dir / f"legacy_import_{uuid.uuid4().hex}.raw.sql"
    utf8_path: Path | None = None

    bytes_written = 0
    try:
        # 1. Stream upload to disk
        with raw_path.open("wb") as out:
            while True:
                chunk = await dump.read(CHUNK_BYTES)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_DUMP_BYTES:
                    raise HTTPException(
                        413, f"Fisier prea mare. Limita = {MAX_DUMP_BYTES // (1024*1024)} MB."
                    )
                out.write(chunk)

        if bytes_written == 0:
            raise HTTPException(400, "Fisier gol.")

        # 2. Detect encoding via BOM, convert to UTF-8 if needed.
        with raw_path.open("rb") as f:
            bom = f.read(2)

        if bom == b"\xff\xfe":
            log.info("Legacy import: dump is UTF-16 LE, converting to UTF-8")
            utf8_path = tmp_dir / f"legacy_import_{uuid.uuid4().hex}.utf8.sql"
            # Convert in one pass — 200MB fits easily on a server with 4GB RAM.
            # For larger dumps we'd stream; for now decode->encode is fine.
            data = raw_path.read_bytes()
            utf8_path.write_bytes(data.decode("utf-16-le").encode("utf-8"))
            dump_path = utf8_path
        else:
            dump_path = raw_path

        # 3. Run the orchestrator
        try:
            result = await run_import(
                dump_path=dump_path,
                username=username,
                password=password,
                account_name=account_name,
                dry_run=dry_run,
            )
        except UsernameExists as e:
            raise HTTPException(409, f"Username '{e.username}' deja folosit (id={e.existing_id}).")
        except FileNotFoundError as e:
            raise HTTPException(400, str(e))

        return result

    finally:
        # 4. Cleanup
        for p in (raw_path, utf8_path):
            if p is not None and p.exists():
                try:
                    os.unlink(p)
                except OSError as exc:
                    log.warning("Nu pot sterge tmp file %s: %s", p, exc)
