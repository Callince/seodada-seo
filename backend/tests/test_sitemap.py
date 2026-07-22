from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import pytest

from app.api.v1.public_content import _STATIC_ROUTES, sitemap
from app.db.models import Blog, WebStory

NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def _locs(xml: str) -> list[str]:
    return [u.findtext("s:loc", namespaces=NS) for u in ET.fromstring(xml).findall("s:url", NS)]


@pytest.mark.asyncio
async def test_sitemap_lists_published_content_and_every_static_route(db):
    """The hand-maintained sitemap this replaced listed 12 URLs and had fallen
    behind the router: the tools page and every post and story were absent.
    Assert the generated one covers both halves."""
    db.add_all(
        [
            Blog(
                title="Live post",
                slug="live-post",
                status="published",
                published_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
                updated_at=datetime(2026, 3, 4, tzinfo=timezone.utc),
            ),
            Blog(title="Draft post", slug="draft-post", status="draft"),
            WebStory(
                title="Live story",
                slug="live-story",
                status="published",
                published_at=datetime(2026, 2, 2, tzinfo=timezone.utc),
            ),
            WebStory(title="Draft story", slug="draft-story", status="draft"),
        ]
    )
    await db.commit()

    locs = _locs((await sitemap(db=db)).body.decode())

    # Drafts must never leak into a public sitemap.
    assert not any("draft-post" in u or "draft-story" in u for u in locs)
    assert any(u.endswith("/blog/live-post") for u in locs)
    assert any(u.endswith("/webstories/live-story") for u in locs)

    # Every static route ships.
    for path, _, _ in _STATIC_ROUTES:
        assert any(u.endswith(path) or u.rstrip("/").endswith(path) for u in locs), path

    # The individual tools sit behind RequireAuth and redirect anonymous
    # visitors to /login, so they must never appear — a sitemap full of
    # auth-gated URLs is worse than one that omits them.
    assert not any("/tools/" in u for u in locs)
    # Both public pages are listed: /features is the platform overview and
    # /free-tools is the working no-login tool page. The in-app tool screens
    # (/tools/*) stay out — they are behind RequireAuth, asserted above.
    assert any(u.endswith("/features") for u in locs)
    assert any(u.endswith("/free-tools") for u in locs)


@pytest.mark.asyncio
async def test_sitemap_is_well_formed_and_has_no_duplicate_urls(db):
    """A duplicate <loc> makes a sitemap invalid, and it is the failure mode a
    hand-edited file drifts into once content is added from two places."""
    db.add(
        Blog(
            title="P",
            slug="p",
            status="published",
            published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
    )
    await db.commit()

    xml = (await sitemap(db=db)).body.decode()
    ET.fromstring(xml)  # raises on malformed XML
    locs = _locs(xml)
    assert len(locs) == len(set(locs))


@pytest.mark.asyncio
async def test_blog_lastmod_prefers_updated_at_over_published_at(db):
    """lastmod drives recrawl priority, so an edited post has to report the
    edit date rather than the original publication date."""
    db.add(
        Blog(
            title="Edited",
            slug="edited",
            status="published",
            published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 5, 20, tzinfo=timezone.utc),
        )
    )
    await db.commit()

    root = ET.fromstring((await sitemap(db=db)).body.decode())
    entry = next(
        u for u in root.findall("s:url", NS) if u.findtext("s:loc", namespaces=NS).endswith("/blog/edited")
    )
    assert entry.findtext("s:lastmod", namespaces=NS) == "2026-05-20"
