"""Tiered Adaptive Crawler — next-gen scraping engine.

Replaces the duplicated fetch/parse logic scattered across crawler.py,
utils/link_analyzer.py, utils/seo_analyzer.py, utils/text_extractor.py,
utils/image_extractor.py, utils/sitemap_utils.py.

See plan at: ~/.claude/plans/cryptic-sniffing-dolphin.md
"""

from app.integrations.scraper.config import CrawlerConfig, TLS_PROFILES, get_config
from app.integrations.scraper.parser import parse_html, needs_js, ParsedDoc
from app.integrations.scraper.fetcher import AsyncFetcher, FetchResult, Persona
from app.integrations.scraper.cache import ETagCache
from app.integrations.scraper.frontier import Frontier, normalize_url
from app.integrations.scraper.politeness import PolitenessManager, HostGovernor, RobotsCache, CircuitOpenError
from app.integrations.scraper.engine import TieredCrawler, CrawlRecord, CrawlReport

__all__ = [
    "CrawlerConfig",
    "TLS_PROFILES",
    "get_config",
    "parse_html",
    "needs_js",
    "ParsedDoc",
    "AsyncFetcher",
    "FetchResult",
    "Persona",
    "ETagCache",
    "Frontier",
    "normalize_url",
    "PolitenessManager",
    "HostGovernor",
    "RobotsCache",
    "CircuitOpenError",
    "TieredCrawler",
    "CrawlRecord",
    "CrawlReport",
]
