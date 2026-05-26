import logging
import re
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("berlinstar.http")


class PathNormalizationMiddleware:
    """ASGI middleware care colapseaza slash-uri multiple consecutive la unul singur.

    Unele reverse-proxy-uri externe (edge-ul de pe professorprime.ro) forwardeaza
    paths de tip //api/admin/legacy-import/import (cu // la inceput), iar FastAPI
    returneaza 404 pentru ca rutele sunt inregistrate cu un singur /. Normalizam
    aici, inainte de routing, ca restul stack-ului (logging, route matching) sa
    vada path-ul canonic. Logam o data per request cand normalizarea se aplica,
    ca sa fie usor de depistat in viitor daca infrastructura mai introduce //.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if "//" in path:
                normalized = re.sub(r"/{2,}", "/", path)
                logger.warning(
                    "Path normalized: %r -> %r (slash-uri multiple colapsate)",
                    path, normalized,
                )
                scope = dict(scope)
                scope["path"] = normalized
                raw = scope.get("raw_path")
                if isinstance(raw, (bytes, bytearray)):
                    scope["raw_path"] = re.sub(rb"/{2,}", b"/", bytes(raw))
        await self.app(scope, receive, send)

# Paths that don't need to be logged on every call (keep logs clean)
_SILENT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request/response with method, path, status, duration, and a short request ID."""

    async def dispatch(self, request: Request, call_next):
        rid = uuid.uuid4().hex[:8]
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        silent = path in _SILENT_PATHS

        if not silent:
            logger.info("→ %s %s  rid=%s  ip=%s", request.method, path, rid, client_ip)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(
                "!! %s %s  rid=%s  %.1fms  UNHANDLED: %s",
                request.method,
                path,
                rid,
                elapsed,
                exc,
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Eroare internă de server."},
                headers={"X-Request-Id": rid},
            )

        elapsed = (time.perf_counter() - start) * 1000

        if not silent:
            level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(
                level,
                "← %s %s  rid=%s  status=%d  %.1fms",
                request.method,
                path,
                rid,
                response.status_code,
                elapsed,
            )

        response.headers["X-Request-Id"] = rid
        return response
