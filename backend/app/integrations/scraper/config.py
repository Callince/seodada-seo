"""Env-driven configuration for the tiered adaptive crawler.

All tunables live here. Nothing hardcoded in engine/fetcher/parser.
Reads from environment variables with sensible defaults.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import List, Tuple


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


# ---------------------------------------------------------------------------
# TLS profile + User-Agent pairing.
#
# curl_cffi lets us pick a browser fingerprint ("impersonate") that sets
# JA3/JA4, HTTP/2 SETTINGS, header order, etc. to match a real browser.
# The User-Agent header must match the chosen profile — mixing a Chrome UA
# with a Safari TLS handshake is a dead giveaway.
# ---------------------------------------------------------------------------

TLS_PROFILES: List[Tuple[str, str]] = [
    (
        "chrome124",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ),
    (
        "chrome123",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    ),
    (
        "chrome120",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
    (
        "safari17_0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    ),
    (
        "edge101",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36 Edg/101.0.1210.53",
    ),
]


# Ported from crawler.py:33-57 — file extensions / paths the crawler
# should never bother fetching. Kept as a configurable filter.
DEFAULT_UNWANTED_PATTERNS: List[str] = [
    r"\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|css|js|pdf|doc|docx|xls|xlsx|zip|rar|tar|gz)(\?.*)?$",
    r"/wp-admin/",
    r"/wp-content/uploads/",
    r"/admin/",
    r"/login",
    r"/logout",
    r"/register",
    r"mailto:",
    r"tel:",
    r"ftp:",
    r"javascript:",
    r"^#",
    r"facebook\.com",
    r"twitter\.com",
    r"linkedin\.com",
    r"instagram\.com",
    r"youtube\.com",
    r"google\.com/maps",
]


@dataclass(frozen=True)
class CrawlerConfig:
    # --- HTTP / fetching ------------------------------------------------
    request_timeout_sec: float = 20.0
    connect_timeout_sec: float = 10.0
    max_retries: int = 3
    retry_backoff_base: float = 1.5
    retry_backoff_max: float = 30.0

    # --- Concurrency (AIMD per-host) -----------------------------------
    per_host_concurrency_start: int = 2
    per_host_concurrency_cap: int = 8
    global_concurrency_cap: int = 30
    circuit_breaker_failures: int = 5
    circuit_breaker_cooldown_sec: float = 60.0

    # --- Politeness -----------------------------------------------------
    default_crawl_delay_sec: float = 0.5
    respect_robots_txt: bool = True
    min_per_host_delay_sec: float = 0.0  # hard floor; 0 disables
    # When False, robots.txt Crawl-delay is read but NOT enforced as an
    # inter-request gap. Disallow/Allow rules are still honored. Cap is
    # applied when True — robots.txt delay is clamped to this many seconds.
    enforce_crawl_delay: bool = False
    crawl_delay_cap_sec: float = 2.0

    # --- Emptiness detector (tier-5 escalation) ------------------------
    empty_body_char_threshold: int = 500
    empty_body_script_count: int = 5
    spa_root_char_threshold: int = 1000

    # --- Humanizer ------------------------------------------------------
    hostility_fast_threshold: float = 0.2
    hostility_polite_threshold: float = 0.5
    hostility_decay_per_success: float = 0.02
    hostility_bump_per_429: float = 0.15
    hostility_bump_per_captcha: float = 0.25
    click_delay_mu: float = 1.2       # log-normal mu → median ~3.3s
    click_delay_sigma: float = 0.7
    reading_wpm_min: int = 200
    reading_wpm_max: int = 280
    dwell_skim_min: float = 0.2
    dwell_skim_max: float = 0.9
    dwell_cap_sec: float = 45.0

    # --- Cache ----------------------------------------------------------
    cache_db_path: str = "scraper_cache.sqlite"
    cache_ttl_sec: int = 7 * 24 * 3600  # 1 week

    # --- Frontier -------------------------------------------------------
    bloom_capacity: int = 1_000_000
    bloom_false_positive_rate: float = 0.001

    # --- Parser / filters ----------------------------------------------
    unwanted_patterns: Tuple[str, ...] = field(default_factory=lambda: tuple(DEFAULT_UNWANTED_PATTERNS))

    def unwanted_regex(self) -> re.Pattern:
        return re.compile("|".join(self.unwanted_patterns), re.IGNORECASE)


_cached_config: CrawlerConfig | None = None


def get_config() -> CrawlerConfig:
    """Return the process-wide crawler config (env-loaded, cached)."""
    global _cached_config
    if _cached_config is not None:
        return _cached_config

    _cached_config = CrawlerConfig(
        request_timeout_sec=_env_float("SCRAPER_REQUEST_TIMEOUT", 20.0),
        connect_timeout_sec=_env_float("SCRAPER_CONNECT_TIMEOUT", 10.0),
        max_retries=_env_int("SCRAPER_MAX_RETRIES", 3),
        retry_backoff_base=_env_float("SCRAPER_RETRY_BACKOFF_BASE", 1.5),
        retry_backoff_max=_env_float("SCRAPER_RETRY_BACKOFF_MAX", 30.0),
        per_host_concurrency_start=_env_int("SCRAPER_PER_HOST_START", 2),
        per_host_concurrency_cap=_env_int("SCRAPER_PER_HOST_CAP", 8),
        global_concurrency_cap=_env_int("SCRAPER_GLOBAL_CAP", 30),
        circuit_breaker_failures=_env_int("SCRAPER_CIRCUIT_FAIL", 5),
        circuit_breaker_cooldown_sec=_env_float("SCRAPER_CIRCUIT_COOLDOWN", 60.0),
        default_crawl_delay_sec=_env_float("SCRAPER_DEFAULT_CRAWL_DELAY", 0.5),
        respect_robots_txt=_env_bool("SCRAPER_RESPECT_ROBOTS", True),
        min_per_host_delay_sec=_env_float("SCRAPER_MIN_HOST_DELAY", 0.0),
        enforce_crawl_delay=_env_bool("SCRAPER_ENFORCE_CRAWL_DELAY", False),
        crawl_delay_cap_sec=_env_float("SCRAPER_CRAWL_DELAY_CAP", 2.0),
        empty_body_char_threshold=_env_int("SCRAPER_EMPTY_BODY_CHARS", 500),
        empty_body_script_count=_env_int("SCRAPER_EMPTY_BODY_SCRIPTS", 5),
        spa_root_char_threshold=_env_int("SCRAPER_SPA_ROOT_CHARS", 1000),
        hostility_fast_threshold=_env_float("SCRAPER_HOSTILITY_FAST", 0.2),
        hostility_polite_threshold=_env_float("SCRAPER_HOSTILITY_POLITE", 0.5),
        click_delay_mu=_env_float("SCRAPER_CLICK_MU", 1.2),
        click_delay_sigma=_env_float("SCRAPER_CLICK_SIGMA", 0.7),
        cache_db_path=os.environ.get("SCRAPER_CACHE_DB", "scraper_cache.sqlite"),
        cache_ttl_sec=_env_int("SCRAPER_CACHE_TTL", 7 * 24 * 3600),
        bloom_capacity=_env_int("SCRAPER_BLOOM_CAPACITY", 1_000_000),
        bloom_false_positive_rate=_env_float("SCRAPER_BLOOM_FPR", 0.001),
    )
    return _cached_config


def reset_config_cache() -> None:
    """Test hook — re-read env on next `get_config()` call."""
    global _cached_config
    _cached_config = None
