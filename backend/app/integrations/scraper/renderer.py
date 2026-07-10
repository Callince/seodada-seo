"""Playwright renderer — tier T5 of the pipeline.

Only used when the emptiness detector says a page needs JS, or the
humanizer has escalated a domain to persona mode. Everything else goes
through the cheap HTTP path in ``scraper.fetcher``.

Design notes:

* **Shared browser + context pool.** One Playwright browser is launched
  for the whole crawl run. Contexts (each with its own cookie jar,
  viewport, timezone, UA) are reused across pages. This is the single
  biggest difference vs. Selenium — no "new driver per request."
* **Resource blocking.** Images, fonts, CSS, analytics, and ad domains
  are aborted at the network layer. We only need the rendered HTML,
  not the visual result.
* **playwright-stealth applied per context.** Removes
  ``navigator.webdriver``, patches plugin/MIME type lists, spoofs WebGL
  vendor/renderer, normalizes canvas fingerprint.
* **Lazy import.** ``playwright`` is not installed by default; importing
  ``scraper.renderer`` stays cheap unless you actually construct one.
* **Graceful cleanup.** All contexts and the browser are closed in
  ``close()``. The engine calls this in its ``__aexit__``.
"""

from __future__ import annotations

import asyncio
import random
import time
from typing import List, Optional

from app.integrations.scraper.config import CrawlerConfig, get_config
from app.integrations.scraper.fetcher import FetchResult, Persona
from app.integrations.scraper.humanizer import human_delay


_BLOCKED_RESOURCE_TYPES = {"image", "media", "font", "stylesheet"}
_BLOCKED_DOMAINS = (
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "facebook.net",
    "hotjar.com",
    "segment.io",
    "amplitude.com",
    "mixpanel.com",
    "adsystem",
    "adservice",
)


class PlaywrightRenderer:
    """Playwright-backed renderer. Implements the ``scraper.engine.Renderer`` protocol."""

    def __init__(
        self,
        persona: Persona,
        *,
        config: Optional[CrawlerConfig] = None,
        headless: bool = True,
        stealth: bool = True,
        block_resources: bool = True,
        max_contexts: int = 3,
    ) -> None:
        self._persona = persona
        self._config = config or get_config()
        self._headless = headless
        self._stealth = stealth
        self._block_resources = block_resources
        self._max_contexts = max_contexts

        self._playwright = None
        self._browser = None
        self._contexts: List = []
        self._semaphore = asyncio.Semaphore(max_contexts)
        self._stealth_fn = None

    # ---- lifecycle ----------------------------------------------------
    async def open(self) -> None:
        if self._browser is not None:
            return
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise RuntimeError(
                "Playwright is not installed. Run:\n"
                "  pip install playwright playwright-stealth\n"
                "  playwright install chromium"
            ) from exc

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self._headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        if self._stealth:
            try:
                from playwright_stealth import stealth_async  # type: ignore
                self._stealth_fn = stealth_async
            except ImportError:
                self._stealth_fn = None

    async def close(self) -> None:
        for ctx in self._contexts:
            try:
                await ctx.close()
            except Exception:
                pass
        self._contexts.clear()
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    async def __aenter__(self) -> "PlaywrightRenderer":
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    # ---- public API ---------------------------------------------------
    async def render(
        self,
        url: str,
        *,
        referer: Optional[str] = None,
        wait_for: str = "domcontentloaded",
        humanize: bool = True,
    ) -> FetchResult:
        """Navigate to ``url`` and return the rendered HTML as a ``FetchResult``."""
        if self._browser is None:
            await self.open()
        assert self._browser is not None

        async with self._semaphore:
            t0 = time.time()
            context = await self._make_context()
            page = await context.new_page()

            if self._block_resources:
                await page.route("**/*", self._route_handler)

            if self._stealth_fn is not None:
                try:
                    await self._stealth_fn(page)
                except Exception:
                    pass

            headers = {}
            if referer:
                headers["Referer"] = referer
            if headers:
                await page.set_extra_http_headers(headers)

            status = 0
            final_url = url
            body = ""
            err: Optional[str] = None
            try:
                response = await page.goto(
                    url,
                    wait_until=wait_for,
                    timeout=int(self._config.request_timeout_sec * 1000),
                )
                if response is not None:
                    status = response.status
                final_url = page.url

                if humanize:
                    await self._simulate_human(page)

                body = await page.content()
            except Exception as exc:
                err = str(exc)
            finally:
                try:
                    await page.close()
                except Exception:
                    pass
                try:
                    await context.close()
                except Exception:
                    pass

            elapsed = time.time() - t0
            return FetchResult(
                url=url,
                final_url=final_url,
                status=status,
                headers={},
                body=body,
                body_bytes=body.encode("utf-8", errors="replace") if body else b"",
                elapsed_sec=elapsed,
                error=err,
                persona=self._persona,
            )

    # ---- internals ----------------------------------------------------
    async def _make_context(self):
        """Build a browser context with persona-driven viewport, TZ, UA."""
        assert self._browser is not None
        return await self._browser.new_context(
            user_agent=self._persona.user_agent,
            viewport={
                "width": self._persona.viewport[0],
                "height": self._persona.viewport[1],
            },
            locale=self._persona.accept_language.split(",")[0],
            timezone_id=self._persona.timezone,
            color_scheme=self._persona.color_scheme,
            device_scale_factor=1,
            is_mobile=False,
            has_touch=False,
        )

    async def _route_handler(self, route) -> None:
        """Block heavy resource types and known tracker/ad domains."""
        req = route.request
        if req.resource_type in _BLOCKED_RESOURCE_TYPES:
            await route.abort()
            return
        url = req.url.lower()
        if any(d in url for d in _BLOCKED_DOMAINS):
            await route.abort()
            return
        await route.continue_()

    async def _simulate_human(self, page) -> None:
        """Light human-like interaction: scroll, small mouse movement, pause."""
        try:
            await page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass

        # Scroll in a few jittered steps to trigger lazy-load
        try:
            height = await page.evaluate("() => document.body.scrollHeight || 0")
        except Exception:
            height = 0
        if height > 800:
            steps = random.randint(3, 6)
            step_size = height // steps
            for i in range(1, steps + 1):
                try:
                    await page.evaluate(f"window.scrollTo(0, {step_size * i})")
                except Exception:
                    break
                await asyncio.sleep(random.uniform(0.15, 0.45))

        # Tiny mouse drift (Bezier-ish, not straight)
        try:
            x, y = random.randint(100, 800), random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(5, 15))
        except Exception:
            pass

        # One log-normal pause, clamped so we don't hang forever
        pause = min(human_delay(config=self._config), 3.0)
        await asyncio.sleep(pause)
