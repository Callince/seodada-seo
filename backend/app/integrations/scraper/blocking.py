"""Bot-protection / anti-crawler challenge detection.

Sites behind Cloudflare, DataDome, PerimeterX, Akamai, Imperva, etc. answer an
automated request with a JS "challenge" page (HTTP 403/429/503 + a body that has
no real content). Our tools would otherwise parse that challenge as if it were
the page — showing a "Just a moment…" title and zero links. `detect_block`
recognises those responses so the UI can say *why* a site won't crawl.

Detection is deliberately conservative: it requires a known vendor header or an
unmistakable challenge marker (not merely a 403), so a normal 403/404 page is
never mislabelled as a block.
"""
from __future__ import annotations

# (provider label, substrings that only appear on that vendor's challenge page)
_BODY_MARKERS: list[tuple[str, tuple[str, ...]]] = [
    ("Cloudflare", ("just a moment", "cf-chl", "cf_chl", "/cdn-cgi/challenge-platform", "__cf_chl", "attention required! | cloudflare", "checking your browser before accessing")),
    ("DataDome", ("datadome", "captcha-delivery.com")),
    ("PerimeterX / HUMAN", ("px-captcha", "perimeterx", "/_px/", "human challenge")),
    ("Akamai", ("akamaighost", "reference #18.", "errors.edgesuite.net")),
    ("Imperva / Incapsula", ("incapsula", "_incapsula_resource", "imperva")),
    ("Sucuri", ("sucuri", "cloudproxy")),
]

# Generic markers that indicate a challenge/CAPTCHA regardless of vendor.
_GENERIC_MARKERS = (
    "enable javascript and cookies to continue",
    "please enable cookies",
    "are you a human",
    "verify you are a human",
    "checking if the site connection is secure",
    "ddos protection by",
    "g-recaptcha", "h-captcha", "hcaptcha",
)


def detect_block(status: int, headers: dict | None, body: str | None) -> str | None:
    """Return the bot-protection provider (a short label) if this response looks
    like a challenge/block, else None."""
    h = {str(k).lower(): str(v or "") for k, v in (headers or {}).items()}
    server = h.get("server", "").lower()
    body_l = (body or "").lower()

    # Strong, header-level signals first.
    if h.get("cf-mitigated", "").lower() == "challenge":
        return "Cloudflare"
    if "x-datadome" in h or h.get("x-datadome-cid"):
        return "DataDome"
    if "x-iinfo" in h or "incap_ses" in h.get("set-cookie", "").lower():
        return "Imperva / Incapsula"

    challenged = status in (401, 403, 405, 429, 503)

    for provider, markers in _BODY_MARKERS:
        if any(m in body_l for m in markers):
            # A body marker is enough on a challenge status; on 200 require the
            # server header too (avoids flagging a page that merely mentions it).
            if challenged or provider.split()[0].lower() in server:
                return provider

    if challenged and any(m in body_l for m in _GENERIC_MARKERS):
        return "bot protection"

    return None


def block_message(domain: str, provider: str, status: int) -> str:
    """User-facing explanation + the realistic fix (for a site you control)."""
    return (
        f"{domain} is blocking automated access with {provider}'s bot challenge "
        f"(HTTP {status}). Every request — including robots.txt and sitemap.xml — is "
        "answered with a JavaScript challenge instead of the page, so there's nothing "
        "to read. If this is your own site, lower the protection for the crawl: in "
        "Cloudflare turn off Bot Fight Mode (Security → Bots) and 'Under Attack' mode, or "
        "add a WAF Skip rule / IP allow-rule for the machine running this audit, then "
        "re-run. Trying the JS-rendering option can get past a lightweight challenge. If "
        "it isn't your site, it does not permit automated crawling."
    )
