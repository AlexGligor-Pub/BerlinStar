"""Custom exceptions for the eFactura ANAF module."""
from __future__ import annotations


class EFacturaError(Exception):
    """Generic eFactura error."""


class AnafConfigError(EFacturaError):
    """Missing or invalid ANAF configuration (client_id, secret, redirect, etc.)."""


class AnafAuthError(EFacturaError):
    """Authentication / authorization problem with ANAF."""


class AnafTokenExpired(AnafAuthError):
    """The refresh token has expired (>90 days) and a new full OAuth flow is required."""


class AnafTokenMissing(AnafAuthError):
    """No token stored for this company."""


class AnafRateLimited(EFacturaError):
    """ANAF returned 429 or similar rate limit signal."""


class AnafValidationError(EFacturaError):
    """Local pre-upload validation failed (returns list of issues)."""

    def __init__(self, issues: list[str]):
        self.issues = issues
        super().__init__("; ".join(issues))


class AnafUploadError(EFacturaError):
    """ANAF rejected the upload payload."""

    def __init__(self, message: str, *, anaf_titlu: str | None = None, raw: dict | None = None):
        self.anaf_titlu = anaf_titlu
        self.raw = raw or {}
        super().__init__(message)
