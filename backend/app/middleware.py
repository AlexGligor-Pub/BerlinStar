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

# Paths complet ignorate la logging (in/out). Acoperim:
# - probe-uri (docker healthcheck, /docs, /openapi.json)
# - SSE long-poll: o conexiune deschisa minute/ore in sir nu trebuie sa polueze
#   logul cu un INFO per (re)conexiune cand readyState=CLOSED face client-side
#   un retry exponential rapid (1s, 2s, ...). Erorile (4xx/5xx) se logheaza
#   in continuare la WARNING.
_SILENT_PATHS = {
    "/api/health",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/receipts/events",
}

# Paths pentru care logam DOAR raspunsurile non-2xx (banner-ul de subscription
# face un poll periodic ~30min, dar nu vrem zgomot daca cresc frequency-ul).
_QUIET_PATHS = {
    "/api/subscription/me",
}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logging articulat per request/response.

    Trei niveluri de verbozitate:
    - _SILENT_PATHS: nimic la 2xx; WARNING la >=400. DEBUG ramane disponibil cu
      LOG_LEVEL=DEBUG pentru investigatii punctuale.
    - _QUIET_PATHS: la fel ca _SILENT_PATHS — doar non-2xx la WARNING.
    - restul: o linie "→" la intrare + o linie "←" la iesire (sau "!!" pe exc).
    """

    async def dispatch(self, request: Request, call_next):
        rid = uuid.uuid4().hex[:8]
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        silent = path in _SILENT_PATHS
        quiet = path in _QUIET_PATHS

        if not silent and not quiet:
            logger.info("→ %s %s  rid=%s  ip=%s", request.method, path, rid, client_ip)
        else:
            logger.debug("→ %s %s  rid=%s  ip=%s", request.method, path, rid, client_ip)

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
        status = response.status_code

        if silent or quiet:
            # Doar erorile sunt zgomotoase — un /api/health 503 sau un SSE 401
            # chiar e ceva ce vrei sa vezi imediat.
            if status >= 400:
                logger.warning(
                    "← %s %s  rid=%s  status=%d  %.1fms",
                    request.method, path, rid, status, elapsed,
                )
            else:
                logger.debug(
                    "← %s %s  rid=%s  status=%d  %.1fms",
                    request.method, path, rid, status, elapsed,
                )
        else:
            level = logging.WARNING if status >= 400 else logging.INFO
            logger.log(
                level,
                "← %s %s  rid=%s  status=%d  %.1fms",
                request.method,
                path,
                rid,
                status,
                elapsed,
            )

        response.headers["X-Request-Id"] = rid
        return response
