"""Logare pe o linie, cu job_id/account_id acolo unde exista context."""
from __future__ import annotations

import logging
import sys

from app.config import RADAR_LOG_LEVEL

FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def setup_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        root.setLevel(RADAR_LOG_LEVEL)
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FORMAT, datefmt="%Y-%m-%dT%H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(RADAR_LOG_LEVEL)
    for noisy in ("httpx", "httpcore", "apscheduler.executors.default"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
