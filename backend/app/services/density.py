"""Local keyword-density analysis.

The page HTML is fetched directly (not through DataForSEO) and the density is
computed in-process, so this part of On-Page analysis costs $0. The fetch is
guarded against SSRF: only http(s), public hosts, capped size and time.
"""
from __future__ import annotations

import asyncio
import html
import ipaddress
import re
import socket
from collections import Counter
from urllib.parse import urlparse

import httpx

from app.core.logging import log

# Shared, pooled client for fetching arbitrary web pages (On-Page + competitor
# benchmarking). Reusing one client gives connection keep-alive, HTTP/2 (with
# automatic HTTP/1.1 fallback) and a bounded connection pool, instead of paying
# a fresh TLS handshake on every fetch.
_PAGE_CLIENT = httpx.AsyncClient(
    follow_redirects=True,
    http2=True,
    timeout=httpx.Timeout(15.0, connect=8.0),
    headers={"User-Agent": "Mozilla/5.0 (SEO-Console)"},
    limits=httpx.Limits(max_connections=24, max_keepalive_connections=12),
)


async def close() -> None:
    """Close the shared page-fetch client (called on app shutdown)."""
    await _PAGE_CLIENT.aclose()

_SCRIPT_STYLE = re.compile(r"<(script|style|noscript)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_TAG = re.compile(r"<[^>]+>")
_WORD = re.compile(r"[a-z0-9']+")
_WS = re.compile(r"\s+")
_MAX_BYTES = 3_000_000

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "being", "at", "by", "as", "it",
    "this", "that", "these", "those", "from", "your", "you", "we", "our", "us",
    "i", "he", "she", "they", "them", "his", "her", "their", "its", "if", "then",
    "so", "not", "no", "do", "does", "did", "have", "has", "had", "will", "would",
    "can", "could", "should", "may", "might", "about", "into", "over", "more",
    "all", "any", "each", "which", "who", "what", "when", "where", "how", "why",
}


class FetchError(Exception):
    pass


# DNS64 resolvers (common on IPv6-only ISPs like Jio) synthesize a fake IPv6
# in the NAT64 well-known prefix for every v4-only host. Python flags that
# whole prefix as "reserved", so judge the embedded IPv4 instead (RFC 6052).
_NAT64 = ipaddress.ip_network("64:ff9b::/96")


def _effective_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address):
    if isinstance(ip, ipaddress.IPv6Address) and ip in _NAT64:
        return ipaddress.ip_address(int(ip) & 0xFFFFFFFF)
    return ip


async def _is_public_host(host: str) -> bool:
    """Resolve `host` off the event loop and reject private/loopback targets."""
    try:
        loop = asyncio.get_running_loop()
        infos = await loop.getaddrinfo(host, None)
    except (socket.gaierror, OSError):
        return False
    for info in infos:
        ip = _effective_ip(ipaddress.ip_address(info[4][0]))
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


async def fetch_html(url: str) -> str:
    """Fetch raw page HTML through the shared pooled client (SSRF-guarded)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise FetchError("Only http(s) URLs are supported.")
    if not await _is_public_host(parsed.hostname):
        raise FetchError("Refusing to fetch a private or unresolvable host.")
    try:
        resp = await _PAGE_CLIENT.get(url)
        resp.raise_for_status()
        raw = resp.content[:_MAX_BYTES]
    except httpx.HTTPError as exc:
        raise FetchError(f"Could not fetch the page: {exc}") from exc
    return raw.decode(resp.encoding or "utf-8", errors="ignore")


async def fetch_text(url: str) -> str:
    return extract_text(await fetch_html(url))


def extract_text(html_doc: str) -> str:
    no_scripts = _SCRIPT_STYLE.sub(" ", html_doc)
    stripped = _TAG.sub(" ", no_scripts)
    return _WS.sub(" ", html.unescape(stripped)).strip()


def _tokens(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def _ngrams(tokens: list[str], n: int) -> Counter:
    if n <= 1:
        return Counter(tokens)
    return Counter(" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def _phrase_ok(phrase: str) -> bool:
    """Keep phrases that read like real terms (no stopword edges, no tiny words)."""
    parts = phrase.split()
    if any(len(p) <= 1 for p in parts):
        return False
    if parts[0] in _STOPWORDS or parts[-1] in _STOPWORDS:
        return False
    # Reject phrases that are entirely stopwords.
    return any(p not in _STOPWORDS for p in parts)


def _top_phrases(
    tokens: list[str], total: int, n: int, limit: int, seen: set[str]
) -> list[dict]:
    rows: list[dict] = []
    for phrase, count in _ngrams(tokens, n).most_common():
        if count < 2 or phrase in seen or not _phrase_ok(phrase):
            continue
        rows.append(
            {"keyword": phrase, "frequency": count, "density": round(count * n / total * 100, 2)}
        )
        seen.add(phrase)
        if len(rows) >= limit:
            break
    return rows


def keyword_frequency(text: str, keyword: str) -> tuple[int, float]:
    """Exact-phrase frequency and density (%) of `keyword` within `text`."""
    tokens = _tokens(text)
    total = len(tokens)
    kw_tokens = _tokens(keyword or "")
    if total == 0 or not kw_tokens:
        return 0, 0.0
    n = len(kw_tokens)
    freq = _ngrams(tokens, n).get(" ".join(kw_tokens), 0)
    return freq, round(freq * n / total * 100, 2)


def density(text: str, target_keyword: str | None, top_n: int = 12) -> list[dict]:
    """Keyword density across unigrams, bigrams and trigrams.

    Single words alone are weak SEO signals, so we surface the top multi-word
    phrases too. The target keyword (if given) is always the first row.
    """
    tokens = _tokens(text)
    total = len(tokens)
    if total == 0:
        return []

    rows: list[dict] = []
    seen: set[str] = set()

    if target_keyword and target_keyword.strip():
        kw = target_keyword.strip().lower()
        kw_tokens = _tokens(kw)
        if kw_tokens:
            freq, dens = keyword_frequency(text, kw)
            rows.append({"keyword": kw, "frequency": freq, "density": dens})
            seen.add(" ".join(kw_tokens))

    for word, count in _ngrams(tokens, 1).most_common():
        if word in seen or word in _STOPWORDS or len(word) <= 2:
            continue
        rows.append({"keyword": word, "frequency": count, "density": round(count / total * 100, 2)})
        seen.add(word)
        if sum(1 for r in rows if " " not in r["keyword"]) >= top_n:
            break

    # Multi-word phrases — the genuinely useful part for SEO.
    rows.extend(_top_phrases(tokens, total, 2, 6, seen))
    rows.extend(_top_phrases(tokens, total, 3, 4, seen))

    log.info("density", total_words=total, rows=len(rows))
    return rows


def doc_terms(text: str, min_count: int = 2, limit: int = 120) -> dict[str, int]:
    """Meaningful unigrams + bigrams with their frequency — used for the
    content-gap comparison against competitor pages.
    """
    tokens = _tokens(text)
    out: Counter = Counter()
    for word, count in _ngrams(tokens, 1).items():
        if count >= min_count and word not in _STOPWORDS and len(word) > 2:
            out[word] = count
    for phrase, count in _ngrams(tokens, 2).items():
        if count >= min_count and _phrase_ok(phrase):
            out[phrase] = count
    return dict(out.most_common(limit))


def word_count(text: str) -> int:
    return len(_tokens(text))


def first_words(text: str, n: int = 120) -> str:
    """First `n` words of body text — used for keyword-in-intro detection."""
    return " ".join(_tokens(text)[:n])
