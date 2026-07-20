from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # DataForSEO
    dfs_login: str = "login"
    dfs_password: str = "password"
    dfs_use_sandbox: bool = True

    @property
    def dfs_base_url(self) -> str:
        return (
            "https://sandbox.dataforseo.com"
            if self.dfs_use_sandbox
            else "https://api.dataforseo.com"
        )

    # Data providers (per module). Each module can independently use a free
    # source instead of DataForSEO. Values:
    #   serp_provider:    "dataforseo" | "brave"  (brave needs brave_api_key)
    #   onpage_provider:  "dataforseo" | "local"  (fetch + parse the page in-process, $0)
    #   trends_provider:  "dataforseo" | "google" (Google Trends public API, $0)
    #   content_provider: "dataforseo" | "local"  (VADER sentiment over the SERP corpus, $0)
    serp_provider: str = "dataforseo"
    onpage_provider: str = "dataforseo"
    trends_provider: str = "dataforseo"
    content_provider: str = "dataforseo"
    # Free Brave Search API key (https://brave.com/search/api/). Enables real,
    # zero-cost SERP data; when serp_provider="brave" but this is unset we fall
    # back to DataForSEO so the app never silently breaks.
    brave_api_key: str = ""
    # OpenPageRank (domcop.com/openpagerank) — free domain-authority scores.
    # Used as an automatic fallback for the authority metric when the DataForSEO
    # Backlinks subscription is not active. Free tier: 10k req/hour.
    openpagerank_api_key: str = ""

    # Google OAuth sign-in. When client id/secret are set, "Continue with Google"
    # works; otherwise the button 404s and password login is used.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://seo.fourdm.services/api/v1/auth/google/callback"
    # Gmail API send (HTTPS — works where DigitalOcean blocks SMTP). A one-time
    # gmail.send refresh token for the sending mailbox; when set, signup requires
    # an emailed code. Empty -> signup is instant (no verification email).
    google_gmail_refresh_token: str = ""

    # Site Audit crawler (self-hosted, $0). Tuned for a small 2 GB / 1 vCPU box:
    # bounded concurrency, a hard wall-clock budget, and a real browser UA so
    # sites don't serve a bot wall. Raise concurrency on a larger server.
    crawl_concurrency: int = 6              # pages fetched in parallel per batch
    crawl_max_concurrent_jobs: int = 2      # simultaneous site crawls (memory guard)
    crawl_total_timeout_seconds: int = 150  # hard cap on a single crawl's runtime
    crawl_timeout_seconds_per_page: float = 15.0
    # Identifiable token in the crawler UA — allowlist THIS in a site's WAF
    # (e.g. Cloudflare → Security → WAF → Custom rules → Skip) to audit a
    # bot-protected site you own. Kept as a separate field so the message and
    # the UA can never drift apart.
    crawl_user_agent_tag: str = "FourDM-SiteAuditor"
    crawl_user_agent: str = (
        "Mozilla/5.0 (compatible; FourDM-SiteAuditor/1.0; +https://seo.fourdm.services) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    # Advanced scraper (App B TieredCrawler) — powers the Site Audit crawl with
    # curl_cffi TLS spoofing (Cloudflare-resistant), selectolax parsing, robots +
    # AIMD politeness, and ETag caching.
    crawl_max_depth: int = 5                 # BFS depth cap; max_pages still bounds size
    scraper_cache_db: str = "scraper_cache.sqlite"  # ETag/frontier SQLite (writable path)
    # JS rendering via Playwright. Off by default (the HTTP crawl already spoofs
    # TLS); enable for SPA sites — also run `playwright install chromium`.
    scraper_render_js: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # Cache / queue
    cache_backend: str = "memory"  # "redis" | "memory"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    reset_token_minutes: int = 30  # password-reset link validity

    # Quotas
    default_org_quota_cents: int = 5000
    # Daily analysis-count limit (seodada model): the active plan's usage_per_day,
    # or this free allowance when there's no subscription. Toggle off to disable.
    quota_enabled: bool = True
    free_daily_analyses: int = 10

    # Where admin-uploaded content images (blog covers / inline) are written.
    # Defaults to the frontend's public content-assets dir so uploads sit next to
    # the migrated seodada images and are served from the same /content-assets/
    # path. In production point this at the nginx-served content-assets location
    # (or a shared volume) so freshly uploaded files are reachable.
    content_upload_dir: str = r"D:\data for seo\frontend\public\content-assets\uploads"

    # Platform admins — comma-separated emails granted access to /admin
    # (user management + per-user spend reporting). The User.role column is
    # org-scoped; this list is the platform-wide gate.
    admin_emails: str = ""

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    # Rate limiting (fixed-window per minute). Per-org limit guards the billed
    # API groups; the tighter per-IP limit guards the unauthenticated auth routes.
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    login_rate_limit_per_minute: int = 10
    # Anonymous landing-page analyzer: each call fetches a third-party page, so
    # keep it low — enough to try the product, not enough to abuse it.
    public_demo_rate_limit_per_minute: int = 3

    # Scheduler (recurring automated jobs, e.g. weekly Site Reports).
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 300

    # Automated rank tracking: re-check every tracked keyword daily and email
    # the org owner when a position moves by at least rank_alert_delta spots
    # (or enters/leaves the top 100).
    rank_autocheck_enabled: bool = True
    rank_alert_delta: int = 3

    # Email delivery (optional). When smtp_host is set, scheduled reports are
    # emailed to the schedule's recipient (params.email, else the owner's email).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "seo-reports@example.com"
    smtp_use_tls: bool = True

    @property
    def emails_enabled(self) -> bool:
        return bool(self.smtp_host.strip()) or bool(self.google_gmail_refresh_token.strip())

    # AI insights. Pick a provider via ai_provider:
    #   "anthropic" — Claude (paid)
    #   "gemini"    — Google Gemini (free tier, key from aistudio.google.com)
    #   "ollama"    — local models (free, runs on your machine; no key)
    ai_provider: str = "gemini"
    anthropic_api_key: str = ""
    # Cheapest current Claude — ideal for this small JSON-generation task.
    # (claude-3-5-haiku was retired 2026-02-19 and now 404s.)
    anthropic_model: str = "claude-haiku-4-5"
    gemini_api_key: str = ""
    # Free-tier Gemini. (gemini-1.5-* and 2.0-* are shut down and 404.
    # Note: Google retires gemini-2.5-flash on 2026-10-16 -> gemini-3.5-flash.)
    gemini_model: str = "gemini-2.5-flash"
    # Used automatically when the primary model's free-tier quota is exhausted
    # (HTTP 429) — the lite variant has its own, larger free quota.
    gemini_fallback_model: str = "gemini-2.5-flash-lite"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    @property
    def ai_enabled(self) -> bool:
        provider = self.ai_provider.strip().lower()
        if provider == "anthropic":
            return bool(self.anthropic_api_key.strip())
        if provider == "gemini":
            return bool(self.gemini_api_key.strip())
        if provider == "ollama":
            return bool(self.ollama_base_url.strip())
        return False

    # --- Content factory (AI blog generation) -------------------------------
    # Blog text is generated with the AI provider above (Claude/Gemini/Ollama).
    # Illustrations come from an image provider with an automatic fallback chain:
    #   image_provider="together"  -> Together AI FLUX.1 schnell (~$0.003/image)
    #   image_provider="replicate" -> Replicate FLUX
    #   image_provider="unsplash"  -> free real photos (no generation)
    # A missing key degrades down the chain to Unsplash, then to no image.
    image_provider: str = "together"
    together_api_key: str = ""
    replicate_api_token: str = ""
    unsplash_access_key: str = ""
    # Autonomous blog pipeline, driven by the shared scheduler (not APScheduler):
    # keyword research, then generation, then a weekly niche refresh.
    blog_generation_enabled: bool = False
    blog_generation_hour: int = 3          # 0-23, server local time
    blog_keyword_research_hour: int = 2
    blog_niche_refresh_weekday: int = 0    # 0=Monday
    blog_auto_publish: bool = False

    @property
    def content_factory_enabled(self) -> bool:
        # Blog text needs an AI provider; images are optional (degrade to none).
        return self.ai_enabled

    # --- Billing (Razorpay + GST) -------------------------------------------
    # When key id/secret are set, subscription checkout + webhooks go live;
    # otherwise billing endpoints report unavailable and the app runs unmetered.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    # Seller details for the GST tax invoice (intra-state CGST+SGST). Defaults
    # from the seodada company; override in .env for a different legal entity.
    seller_name: str = "Fourth Dimension Media Solutions Pvt Ltd"
    seller_gstin: str = "33AABCF6993P1ZY"
    seller_state: str = "Tamil Nadu"
    seller_state_code: str = "33"
    seller_pan: str = "AABCF6993P"
    seller_cin: str = "U22130TN2011PTC079276"
    seller_hsn: str = "998314"  # SAC for digital services
    seller_address: str = "Chennai, Tamil Nadu, India"
    gst_rate_percent: float = 18.0
    invoice_company_name: str = "FourDM"

    @property
    def billing_enabled(self) -> bool:
        return bool(self.razorpay_key_id.strip() and self.razorpay_key_secret.strip())

    # Public site URL — used in emails, GST invoices, and canonical/AMP links.
    #
    # MUST match SITE_URL in frontend/src/lib/seo.tsx. The generated sitemap is
    # built from this value, and a sitemap that lists a different host than the
    # pages' own <link rel="canonical"> is treated as cross-site and largely
    # discarded — so a mismatch here quietly wastes the sitemap.
    #
    # Every other public signal in the app already declares seodada.com: the
    # canonical tags, og:url, and the `Sitemap:` line in robots.txt. This
    # default previously said seo.fourdm.services and disagreed with all of
    # them; it was unused until the sitemap shipped, so nothing surfaced it.
    # Override with SITE_URL if the canonical domain is ever something else.
    site_url: str = "https://seodada.com"

    # CORS
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _require_real_jwt_secret_in_prod(self) -> "Settings":
        # Postgres = production; refuse to boot with the dev signing key.
        if self.database_url.startswith("postgresql") and self.jwt_secret == "dev-secret-change-me":
            raise ValueError("JWT_SECRET must be set to a real secret in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
