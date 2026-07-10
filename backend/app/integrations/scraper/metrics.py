"""Prometheus metrics for the tiered adaptive crawler.

Every value lives in a module-level ``Counter``/``Histogram``/``Gauge`` so
it's visible from anywhere that imports ``scraper.metrics``. The engine
calls ``record_*`` helpers around each fetch; the Flask ``/metrics``
endpoint (see ``scraper.metrics_blueprint``) serves them in the standard
text-exposition format.

No-op fallback: if ``prometheus_client`` isn't installed, the helpers
degrade to no-ops so the rest of the pipeline keeps running.
"""

from __future__ import annotations

from typing import Optional

try:
    from prometheus_client import (
        CollectorRegistry,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
        CONTENT_TYPE_LATEST,
    )
    PROM_AVAILABLE = True
except ImportError:  # pragma: no cover
    PROM_AVAILABLE = False
    CONTENT_TYPE_LATEST = "text/plain; charset=utf-8"  # type: ignore

    class _NoOp:
        def __init__(self, *a, **k) -> None: ...
        def labels(self, *a, **k): return self
        def inc(self, *a, **k): ...
        def observe(self, *a, **k): ...
        def set(self, *a, **k): ...
        def time(self): return _NoOpCM()

    class _NoOpCM:
        def __enter__(self): return self
        def __exit__(self, *a): ...

    Counter = Gauge = Histogram = _NoOp  # type: ignore

    def generate_latest(*a, **k):  # type: ignore
        return b""

    CollectorRegistry = object  # type: ignore


# ---------------------------------------------------------------------------
# Registry — a dedicated one so we don't collide with any other process
# metrics that might already live in the default registry.
# ---------------------------------------------------------------------------

REGISTRY: Optional[CollectorRegistry] = CollectorRegistry() if PROM_AVAILABLE else None


# ---------------------------------------------------------------------------
# Counters / Histograms / Gauges
# ---------------------------------------------------------------------------


fetch_requests_total = Counter(
    "scraper_fetch_requests_total",
    "Total HTTP fetches attempted by the crawler",
    ["host", "status"],
    registry=REGISTRY,
)

fetch_errors_total = Counter(
    "scraper_fetch_errors_total",
    "Total fetches that failed with an exception",
    ["host", "error_type"],
    registry=REGISTRY,
)

fetch_latency_seconds = Histogram(
    "scraper_fetch_latency_seconds",
    "End-to-end fetch latency",
    ["host", "tier"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=REGISTRY,
)

cache_hits_total = Counter(
    "scraper_cache_hits_total",
    "Conditional-GET 304 Not Modified responses",
    ["host"],
    registry=REGISTRY,
)

js_renders_total = Counter(
    "scraper_js_renders_total",
    "Pages escalated to tier-5 Playwright rendering",
    ["host", "reason"],
    registry=REGISTRY,
)

extractors_applied_total = Counter(
    "scraper_extractors_applied_total",
    "Number of times each extractor was run on a parsed doc",
    ["extractor"],
    registry=REGISTRY,
)

per_host_concurrency = Gauge(
    "scraper_per_host_concurrency",
    "Current AIMD concurrency value per host",
    ["host"],
    registry=REGISTRY,
)

circuit_breaker_open = Gauge(
    "scraper_circuit_breaker_open",
    "1 if circuit breaker is open for this host, else 0",
    ["host"],
    registry=REGISTRY,
)

hostility_score = Gauge(
    "scraper_hostility_score",
    "Humanizer per-host hostility score (0.0 - 1.0)",
    ["host"],
    registry=REGISTRY,
)

frontier_size = Gauge(
    "scraper_frontier_size",
    "URLs currently waiting in the frontier",
    registry=REGISTRY,
)


# ---------------------------------------------------------------------------
# Convenience helpers — keep the engine's call sites terse
# ---------------------------------------------------------------------------


def record_fetch(host: str, status: int, elapsed_sec: float, tier: str = "http") -> None:
    fetch_requests_total.labels(host=host, status=str(status)).inc()
    fetch_latency_seconds.labels(host=host, tier=tier).observe(elapsed_sec)


def record_error(host: str, error_type: str) -> None:
    fetch_errors_total.labels(host=host, error_type=error_type).inc()


def record_cache_hit(host: str) -> None:
    cache_hits_total.labels(host=host).inc()


def record_js_render(host: str, reason: str = "emptiness") -> None:
    js_renders_total.labels(host=host, reason=reason).inc()


def record_extractor(name: str) -> None:
    extractors_applied_total.labels(extractor=name).inc()


def update_host_concurrency(host: str, value: float) -> None:
    per_host_concurrency.labels(host=host).set(value)


def update_circuit_state(host: str, is_open: bool) -> None:
    circuit_breaker_open.labels(host=host).set(1 if is_open else 0)


def update_hostility(host: str, score: float) -> None:
    hostility_score.labels(host=host).set(score)


def update_frontier_size(n: int) -> None:
    frontier_size.set(n)


def render_text() -> bytes:
    """Return the Prometheus text-exposition format for the current metrics."""
    if not PROM_AVAILABLE:
        return b""
    return generate_latest(REGISTRY)
