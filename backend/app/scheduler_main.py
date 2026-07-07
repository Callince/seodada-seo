"""Standalone scheduler process entrypoint.

In production the API runs with ``SCHEDULER_ENABLED=false`` and this dedicated
process owns the recurring-job loop. That lets the API scale to multiple
replicas/workers without each one also ticking the scheduler. Schedules are
*claimed* with an atomic conditional UPDATE (see ``services.scheduler``), so even
if more than one ticker ever ran, a job would never be executed twice.

Run it with:  ``python -m app.scheduler_main``
"""
from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import log
from app.services.scheduler import scheduler_loop


def main() -> None:
    log.info("scheduler_process_start", interval=settings.scheduler_interval_seconds)
    try:
        asyncio.run(scheduler_loop(settings.scheduler_interval_seconds))
    except KeyboardInterrupt:  # graceful Ctrl-C / SIGINT
        log.info("scheduler_process_stop")


if __name__ == "__main__":
    main()
