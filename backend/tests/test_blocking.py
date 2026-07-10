"""Bot-protection challenge detection (Cloudflare et al.)."""
from __future__ import annotations

from app.integrations.scraper.blocking import block_message, detect_block


def test_cloudflare_challenge_by_header():
    assert detect_block(403, {"cf-mitigated": "challenge", "server": "cloudflare"}, "Just a moment...") == "Cloudflare"


def test_cloudflare_challenge_by_body():
    body = "<html><head><title>Just a moment...</title></head><body>cf_chl_opt</body></html>"
    assert detect_block(403, {"server": "cloudflare"}, body) == "Cloudflare"


def test_datadome_by_header():
    assert detect_block(403, {"x-datadome": "protected"}, "blocked") == "DataDome"


def test_generic_challenge():
    assert detect_block(503, {"server": "nginx"}, "Please enable JavaScript and cookies to continue") == "bot protection"


def test_normal_pages_are_not_blocks():
    # A real 200 page, a plain 404, and a bare 403 with no markers must NOT flag.
    assert detect_block(200, {"server": "nginx"}, "<html>hello world</html>") is None
    assert detect_block(404, {"server": "nginx"}, "Page not found") is None
    assert detect_block(403, {"server": "nginx"}, "Forbidden") is None


def test_block_message_mentions_provider_and_status():
    msg = block_message("komaki.in", "Cloudflare", 403)
    assert "komaki.in" in msg and "Cloudflare" in msg and "403" in msg
