"""Structured logging for the scraper.

Wraps ``structlog`` so every log event becomes a JSON line with a stable
schema: ``timestamp``, ``level``, ``event``, plus whatever key-value
pairs the call site provides (``url``, ``host``, ``status``, ``tier``,
``elapsed_sec``, etc.). Call ``configure_logging()`` once at process
startup (e.g. from ``app.py`` or when the scraper is used standalone).

Falls back to a plain ``logging`` config if ``structlog`` isn't installed,
so the rest of the code keeps working.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

try:
    import structlog
    STRUCTLOG_AVAILABLE = True
except ImportError:  # pragma: no cover
    structlog = None  # type: ignore
    STRUCTLOG_AVAILABLE = False


_configured = False


def configure_logging(
    *,
    level: str = "INFO",
    json_output: bool | None = None,
) -> None:
    """Idempotent — safe to call from multiple entry points.

    ``json_output`` defaults to True in production (``FLASK_ENV != 'development'``)
    and False when developing so logs stay human-readable.
    """
    global _configured
    if _configured:
        return
    _configured = True

    level_int = getattr(logging, level.upper(), logging.INFO)

    if json_output is None:
        json_output = os.environ.get("FLASK_ENV", "production") != "development"

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level_int,
    )

    if not STRUCTLOG_AVAILABLE:
        return

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_output:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level_int),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "scraper"):
    """Return a bound structlog logger, or a stdlib fallback."""
    if STRUCTLOG_AVAILABLE:
        return structlog.get_logger(name)
    return logging.getLogger(name)
