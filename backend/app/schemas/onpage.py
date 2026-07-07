from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class OnPageRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2000)
    target_keyword: str | None = Field(default=None, max_length=300)
    location_code: int = 2840  # used for SERP benchmarking when a keyword is set
    language_code: str = "en"


class Readability(BaseModel):
    ari: float | None = None
    flesch_kincaid: float | None = None


class DensityRow(BaseModel):
    keyword: str
    frequency: int
    density: float


class SubScore(BaseModel):
    label: str
    score: float
    max: int
    status: str  # good | warn | bad | n/a
    note: str = ""


class KeywordAnalysis(BaseModel):
    keyword: str
    frequency: int
    density: float
    health: str  # absent | low | optimal | high | stuffed
    placements: dict[str, bool]
    placement_count: int


class SnippetMeasure(BaseModel):
    text: str
    pixels: float
    limit_pixels: int
    truncated: bool
    preview: str
    fill_pct: float


class SnippetPreview(BaseModel):
    url: str
    title: SnippetMeasure
    meta_description: SnippetMeasure


class ImageItem(BaseModel):
    src: str
    alt: str | None = None
    has_alt: bool


class ImageAudit(BaseModel):
    total: int
    missing_alt: int
    with_keyword_alt: bool
    items: list[ImageItem] = []


class Indexability(BaseModel):
    canonical: str | None = None
    noindex: bool = False
    nofollow: bool = False
    robots: str | None = None
    has_viewport: bool = False
    lang: str | None = None
    open_graph: bool = False
    twitter_card: bool = False
    schema_types: list[str] = []


class LinkAudit(BaseModel):
    internal: int = 0
    external: int = 0


class GapTerm(BaseModel):
    term: str
    competitors_using: int
    your_count: int


class WordCountBenchmark(BaseModel):
    you: int
    median: int
    max: int


class HeadingBenchmark(BaseModel):
    you: int
    median: int


class Benchmark(BaseModel):
    keyword: str
    competitors_analyzed: int
    word_count: WordCountBenchmark
    headings: HeadingBenchmark
    missing_terms: list[GapTerm] = []


class OnPageResponse(BaseModel):
    url: str
    content_score: float | None = None
    technical_score: float | None = None  # DataForSEO onpage_score, when available
    word_count: int | None = None
    readability: Readability
    keyword_density: list[DensityRow]
    keyword_analysis: KeywordAnalysis | None = None
    subscores: list[SubScore] = []
    title: str | None = None
    meta_description: str | None = None
    h1: list[str] = []
    h2: list[str] = []
    issues: list[str] = []
    recommendations: list[str] = []
    snippet: SnippetPreview | None = None
    images: ImageAudit | None = None
    indexability: Indexability | None = None
    links: LinkAudit | None = None
    benchmark: Benchmark | None = None
    meta: Meta
