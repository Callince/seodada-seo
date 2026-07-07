"""Effective data-provider resolution.

Each research module can be backed by DataForSEO (billed) or a free source.
The configured choice is in `settings`, but the *effective* provider also
depends on whether the required credentials exist — e.g. "brave" silently
degrades to "dataforseo" when no Brave API key is set, so the app never breaks.
"""
from __future__ import annotations

from app.core.config import settings


def serp_provider() -> str:
    """'brave' only when a Brave key is configured; otherwise 'dataforseo'."""
    if settings.serp_provider == "brave" and settings.brave_api_key.strip():
        return "brave"
    return "dataforseo"


def onpage_provider() -> str:
    return "local" if settings.onpage_provider == "local" else "dataforseo"


def trends_provider() -> str:
    return "google" if settings.trends_provider == "google" else "dataforseo"


def content_provider() -> str:
    return "local" if settings.content_provider == "local" else "dataforseo"


def active() -> dict[str, str]:
    """Snapshot of the effective provider per module (for /health & the UI)."""
    return {
        "serp": serp_provider(),
        "keywords": "dataforseo",  # volume/suggestions/related/ideas remain DataForSEO
        "trends": trends_provider(),
        "domains": "dataforseo",
        "onpage": onpage_provider(),
        "content": content_provider(),
    }
