"""Humanized crawling — persona-driven, hostility-adaptive.

Three modes, selected per-domain by the ``HostilityTracker``:

* **fast** (hostility < 0.2) — no humanization, pure throughput
* **polite** (0.2–0.5) — log-normal delays, full header set, referer chain
* **persona** (≥ 0.5) — polite + JS render + scroll/mouse simulation

The tracker bumps hostility on 429/403/CAPTCHA signals and decays it on
clean successes, so a domain can move between modes during a run. Speed
is preserved on friendly targets; stealth kicks in only where it matters.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

from app.integrations.scraper.config import CrawlerConfig, get_config


class Mode(str, Enum):
    FAST = "fast"
    POLITE = "polite"
    PERSONA = "persona"


# ---------------------------------------------------------------------------
# Hostility tracker
# ---------------------------------------------------------------------------


@dataclass
class _HostHostility:
    score: float = 0.0
    successes: int = 0
    failures_429: int = 0
    failures_403: int = 0
    captcha_hits: int = 0
    js_escalations: int = 0


class HostilityTracker:
    """Maintains a 0..1 hostility score per host.

    Bumps on adversarial signals, decays on clean 2xx responses.
    """

    def __init__(self, config: Optional[CrawlerConfig] = None) -> None:
        self._config = config or get_config()
        self._states: Dict[str, _HostHostility] = {}

    def _state(self, host: str) -> _HostHostility:
        st = self._states.get(host)
        if st is None:
            st = _HostHostility()
            self._states[host] = st
        return st

    def observe_success(self, host: str) -> None:
        st = self._state(host)
        st.successes += 1
        st.score = max(0.0, st.score - self._config.hostility_decay_per_success)

    def observe_block(self, host: str, status: int) -> None:
        st = self._state(host)
        bump = 0.0
        if status == 429:
            st.failures_429 += 1
            bump = self._config.hostility_bump_per_429
        elif status == 403:
            st.failures_403 += 1
            bump = self._config.hostility_bump_per_429
        else:
            bump = self._config.hostility_bump_per_429 * 0.5
        st.score = min(1.0, st.score + bump)

    def observe_captcha(self, host: str) -> None:
        st = self._state(host)
        st.captcha_hits += 1
        st.score = min(1.0, st.score + self._config.hostility_bump_per_captcha)

    def observe_js_escalation(self, host: str) -> None:
        st = self._state(host)
        st.js_escalations += 1
        # Small bump — escalation is a weak signal, not a block
        st.score = min(1.0, st.score + 0.05)

    def score(self, host: str) -> float:
        return self._state(host).score

    def mode(self, host: str) -> Mode:
        s = self.score(host)
        if s < self._config.hostility_fast_threshold:
            return Mode.FAST
        if s < self._config.hostility_polite_threshold:
            return Mode.POLITE
        return Mode.PERSONA


# ---------------------------------------------------------------------------
# Timing — log-normal inter-request delay + content-proportional dwell
# ---------------------------------------------------------------------------


def human_delay(
    *,
    mu: Optional[float] = None,
    sigma: Optional[float] = None,
    config: Optional[CrawlerConfig] = None,
) -> float:
    """Sample one log-normal inter-click delay in seconds.

    Real user inter-click gaps fit a log-normal distribution — most gaps
    are short (1–5s), with a long tail for "went to the bathroom" pauses.
    Uniform ``sleep(2)`` is the single biggest bot tell after TLS.
    """
    cfg = config or get_config()
    mu_ = cfg.click_delay_mu if mu is None else mu
    sigma_ = cfg.click_delay_sigma if sigma is None else sigma
    return random.lognormvariate(mu_, sigma_)


def dwell_time(
    word_count: int,
    *,
    reading_wpm: int = 240,
    config: Optional[CrawlerConfig] = None,
) -> float:
    """Estimated "time a human spends on this page" given its word count.

    Reading-speed baseline × skim factor (humans skim, don't read). Capped
    so the crawler can't get stuck on a giant article.
    """
    cfg = config or get_config()
    if word_count <= 0:
        return random.uniform(0.5, 2.5)
    base = (word_count / max(reading_wpm, 60)) * 60.0
    skim = random.uniform(cfg.dwell_skim_min, cfg.dwell_skim_max)
    return min(base * skim, cfg.dwell_cap_sec)


# ---------------------------------------------------------------------------
# Response-body heuristics used by the tracker
# ---------------------------------------------------------------------------


_CAPTCHA_MARKERS = (
    "captcha",
    "cf-challenge",
    "cloudflare-challenge",
    "verify you are a human",
    "please enable javascript",
    "g-recaptcha",
    "hcaptcha",
)


def looks_like_captcha(body: str) -> bool:
    if not body:
        return False
    lowered = body[:4000].lower()
    return any(marker in lowered for marker in _CAPTCHA_MARKERS)


# ---------------------------------------------------------------------------
# Humanizer — one instance per crawl run. Wires everything together.
# ---------------------------------------------------------------------------


@dataclass
class HumanizerAction:
    """What the engine should do before its next fetch on this host."""

    mode: Mode
    pre_fetch_sleep: float = 0.0
    post_fetch_dwell: float = 0.0
    use_js_render: bool = False


class Humanizer:
    def __init__(self, config: Optional[CrawlerConfig] = None) -> None:
        self._config = config or get_config()
        self.tracker = HostilityTracker(self._config)

    def plan(self, host: str, *, last_word_count: int = 0, reading_wpm: int = 240) -> HumanizerAction:
        mode = self.tracker.mode(host)
        action = HumanizerAction(mode=mode)

        if mode is Mode.FAST:
            return action  # zero delay — fast lane

        action.pre_fetch_sleep = human_delay(config=self._config)

        if mode is Mode.POLITE:
            action.post_fetch_dwell = dwell_time(
                last_word_count, reading_wpm=reading_wpm, config=self._config
            ) * 0.3  # polite mode only does a fractional dwell
            return action

        # PERSONA
        action.post_fetch_dwell = dwell_time(
            last_word_count, reading_wpm=reading_wpm, config=self._config
        )
        action.use_js_render = True
        return action

    # Observation hooks — called by the engine around each fetch
    def on_success(self, host: str) -> None:
        self.tracker.observe_success(host)

    def on_block(self, host: str, status: int, body: str = "") -> None:
        self.tracker.observe_block(host, status)
        if looks_like_captcha(body):
            self.tracker.observe_captcha(host)

    def on_js_escalation(self, host: str) -> None:
        self.tracker.observe_js_escalation(host)

    def mode_of(self, host: str) -> Mode:
        return self.tracker.mode(host)

    def score_of(self, host: str) -> float:
        return self.tracker.score(host)
