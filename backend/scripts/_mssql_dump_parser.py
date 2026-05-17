"""Streaming parser for SQL Server T-SQL dump files.

Parses INSERT statements produced by SSMS "Generate Scripts" → Schema and Data.
Designed for the BerlinV3 legacy → BerlinStar Postgres migration but is
intentionally generic enough to be reused for any SSMS dump.

Supported value syntax:
  - N'literal' (with '' escape inside)
  - NULL
  - integer / float / decimal literals
  - CAST(N'YYYY-MM-DDThh:mm:ss[.fff]' AS DateTime2)
  - CAST(123.45 AS Decimal(18, 2))

Usage:
    from scripts._mssql_dump_parser import parse_inserts

    # The dump must already be UTF-8 (convert UTF-16LE with iconv beforehand).
    for row in parse_inserts(Path("dump.sql"), "Receipt"):
        print(row["Id"], row["Total"], row["CreateDate"])

The function is a generator: it streams the file line-by-line and yields one
dict per INSERT row. Memory footprint is constant regardless of file size.
"""
from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Iterator


_INSERT_HEAD_RE = re.compile(
    r"^INSERT \[dbo\]\.\[(?P<table>[^\]]+)\] \((?P<cols>[^)]+)\) VALUES \((?P<vals>.+)\)\s*$"
)
_COLUMN_RE = re.compile(r"\[([^\]]+)\]")


def _parse_columns(cols_str: str) -> list[str]:
    """Extract column names from "[Col1], [Col2], ..."."""
    return _COLUMN_RE.findall(cols_str)


def _parse_values(vals_str: str) -> list[object]:
    """Parse the comma-separated values of a VALUES (...) clause.

    Walks character by character because the values can contain commas inside
    quoted strings (N'foo, bar') and inside CAST(...) expressions.
    """
    out: list[object] = []
    i = 0
    n = len(vals_str)
    while i < n:
        # Skip leading whitespace
        while i < n and vals_str[i] == " ":
            i += 1
        if i >= n:
            break

        # NULL
        if vals_str[i:i+4].upper() == "NULL" and (i+4 == n or vals_str[i+4] in ", "):
            out.append(None)
            i += 4
        # N'...' string literal
        elif vals_str[i] == "N" and i + 1 < n and vals_str[i+1] == "'":
            j = i + 2
            buf: list[str] = []
            while j < n:
                if vals_str[j] == "'":
                    # '' is an escaped single quote
                    if j + 1 < n and vals_str[j+1] == "'":
                        buf.append("'")
                        j += 2
                    else:
                        break
                else:
                    buf.append(vals_str[j])
                    j += 1
            out.append("".join(buf))
            i = j + 1  # past closing quote
        # CAST(...) expression
        elif vals_str[i:i+5].upper() == "CAST(":
            # Find matching close paren
            depth = 0
            j = i
            while j < n:
                c = vals_str[j]
                if c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                j += 1
            cast_expr = vals_str[i:j]
            out.append(_parse_cast(cast_expr))
            i = j
        # Numeric literal
        else:
            j = i
            while j < n and vals_str[j] not in ",":
                j += 1
            tok = vals_str[i:j].strip()
            if "." in tok or "e" in tok.lower():
                try:
                    out.append(float(tok))
                except ValueError:
                    out.append(tok)
            else:
                try:
                    out.append(int(tok))
                except ValueError:
                    out.append(tok)
            i = j

        # Skip comma separator
        while i < n and vals_str[i] in ", ":
            i += 1

    return out


_CAST_DATETIME_RE = re.compile(
    r"CAST\(N'(?P<ts>[0-9T\-:.]+)'\s+AS\s+DateTime2?\)", re.IGNORECASE
)
_CAST_DECIMAL_RE = re.compile(
    r"CAST\((?P<num>-?[0-9.]+)\s+AS\s+Decimal\(\d+,\s*\d+\)\)", re.IGNORECASE
)


def _parse_cast(expr: str) -> object:
    """Decode CAST(N'...' AS DateTime2) or CAST(num AS Decimal(p,s))."""
    m = _CAST_DATETIME_RE.match(expr)
    if m:
        ts = m.group("ts")
        # Strip fractional seconds to <=6 digits (Python datetime supports only microseconds)
        if "." in ts:
            head, frac = ts.split(".", 1)
            frac = frac[:6]
            ts = f"{head}.{frac}"
        try:
            return datetime.fromisoformat(ts)
        except ValueError:
            return None
    m = _CAST_DECIMAL_RE.match(expr)
    if m:
        return Decimal(m.group("num"))
    # Unknown cast — return raw string for caller to inspect
    return expr


def parse_inserts(dump_path: Path, table_name: str) -> Iterator[dict[str, object]]:
    """Yield one dict per INSERT row for the given table name.

    Columns are returned with their original (PascalCase) names so the caller
    can map them explicitly.
    """
    prefix = f"INSERT [dbo].[{table_name}] "
    with dump_path.open(encoding="utf-8") as f:
        for line in f:
            if not line.startswith(prefix):
                continue
            m = _INSERT_HEAD_RE.match(line)
            if not m:
                continue
            cols = _parse_columns(m.group("cols"))
            vals = _parse_values(m.group("vals"))
            if len(cols) != len(vals):
                # Schema vs values length mismatch — skip with no row produced.
                # Caller can detect missing rows via a count comparison if needed.
                continue
            yield dict(zip(cols, vals))


def count_inserts(dump_path: Path, table_name: str) -> int:
    """Quick scan to count INSERT rows for a table (does not parse values)."""
    prefix = f"INSERT [dbo].[{table_name}] "
    n = 0
    with dump_path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith(prefix):
                n += 1
    return n


_INSERT_TABLE_RE = re.compile(r"^INSERT \[dbo\]\.\[([^\]]+)\] ")


def list_tables(dump_path: Path) -> dict[str, int]:
    """Return {table_name: row_count} for all tables that have INSERT rows."""
    out: dict[str, int] = {}
    with dump_path.open(encoding="utf-8") as f:
        for line in f:
            m = _INSERT_TABLE_RE.match(line)
            if m:
                name = m.group(1)
                out[name] = out.get(name, 0) + 1
    return out
