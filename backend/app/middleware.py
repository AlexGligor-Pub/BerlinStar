import logging
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("berlinstar.http")

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
