"""Effective data-provider resolution.

Each research module can be backed by DataForSEO (billed) or a free source.
The configured choice is in `settings`, but the *effective* provider also
depends on whether the required credentials exist — e.g. "local" onpage always
works, while a provider needing a key degrades to DataForSEO when it is absent,
so the app never breaks.

SERP has no alternative provider: Brave was the only one and it was removed once
it stopped being free (2.5x DataForSEO, on a separate invoice). See
docs/PROVIDER_STRATEGY.md §7.1. The SERP engine choice (Google/Bing) is now a
per-request field, not a deployment-wide provider.
"""
from __future__ import annotations

from app.core.config import settings


def onpage_provider() -> str:
    return "local" if settings.onpage_provider == "local" else "dataforseo"


def trends_provider() -> str:
    return "google" if settings.trends_provider == "google" else "dataforseo"


def content_provider() -> str:
    return "local" if settings.content_provider == "local" else "dataforseo"


def active() -> dict[str, str]:
    """Snapshot of the effective provider per module (for /health & the UI)."""
    return {
        "serp": "dataforseo",  # no alternative provider; engine is per-request
        "keywords": "dataforseo",  # volume/suggestions/related/ideas remain DataForSEO
        "trends": trends_provider(),
        "domains": "dataforseo",
        "onpage": onpage_provider(),
        "content": content_provider(),
    }
