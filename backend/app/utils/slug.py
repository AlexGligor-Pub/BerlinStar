"""Identificatori publici pentru URL-uri („Vulcanizare Alex” → „vulcanizare-alex”)."""
from __future__ import annotations
import re
import unicodedata

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MIN, SLUG_MAX = 3, 60


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:SLUG_MAX].rstrip("-")


def is_valid_slug(slug: str) -> bool:
    return SLUG_MIN <= len(slug) <= SLUG_MAX and bool(SLUG_RE.match(slug))
