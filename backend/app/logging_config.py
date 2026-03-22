import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler

LOG_MAX_BYTES = 1 * 1024 * 1024   # 1 MB per fișier
LOG_BACKUP_COUNT = 100             # maxim 100 fișiere rotite
LOG_MAX_AGE_DAYS = 7               # fișiere mai vechi de 7 zile se șterg


def _cleanup_old_logs(log_dir: str) -> None:
    """Șterge fișierele de log mai vechi de LOG_MAX_AGE_DAYS din log_dir."""
    cutoff = time.time() - LOG_MAX_AGE_DAYS * 86400
    try:
        for name in os.listdir(log_dir):
            if not name.startswith("app.log"):
                continue
            path = os.path.join(log_dir, name)
            if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                os.remove(path)
    except OSError:
        pass  # dacă directorul nu există încă, ignorăm


def setup_logging() -> logging.Logger:
    """Configure application-wide logging. Call once at startup."""
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # Handler stdout
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)

    handlers: list[logging.Handler] = [stdout_handler]

    # Handler fișier cu rotire după dimensiune
    log_dir = os.getenv("LOG_DIR", "logs")
    os.makedirs(log_dir, exist_ok=True)
    _cleanup_old_logs(log_dir)

    file_handler = RotatingFileHandler(
        filename=os.path.join(log_dir, "app.log"),
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    handlers.append(file_handler)

    logging.basicConfig(level=log_level, handlers=handlers, force=True)

    # Suppress noisy third-party loggers
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # replaced by our middleware
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("s3transfer").setLevel(logging.WARNING)

    return logging.getLogger("berlinstar")
