from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class AiVisibilityRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    keywords: list[str] = Field(min_length=1, max_length=20)
    location_code: int = 2840
    language_code: str = "en"
    device: Literal["desktop", "mobile"] = "desktop"
    include_ai_mode: bool = True
    force_live: bool = False


class AiVisibilityStartResponse(BaseModel):
    task_id: str


class AiCitation(BaseModel):
    cited: bool = False
    url: str | None = None
    position: int | None = None  # 1-based rank among the AI answer's sources


class AiKeywordRow(BaseModel):
    keyword: str
    ai_overview_present: bool = False
    ai_overview: AiCitation = AiCitation()
    ai_mode_present: bool = False
    ai_mode: AiCitation = AiCitation()
    cited_domains: list[str] = []  # who Google's AI is citing (you + competitors)


class AiVisibilitySummary(BaseModel):
    keywords: int = 0
    ai_overview_present: int = 0   # keywords that triggered an AI Overview
    ai_overview_cited: int = 0     # ...where your domain is cited
    ai_mode_cited: int = 0         # keywords where you're cited in AI Mode
    cost_cents: float = 0


class AiVisibilityStatusResponse(BaseModel):
    task_id: str
    progress: str  # queued | in_progress | finished | error | unknown
    error: str | None = None
    checked: int = 0
    total: int = 0
    domain: str | None = None
    include_ai_mode: bool = True
    rows: list[AiKeywordRow] = []
    summary: AiVisibilitySummary = AiVisibilitySummary()


# ---- LLM mentions / AI volume / ask (AI Optimization API) ----
class MentionsRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    force_live: bool = False


class MentionDimensionRow(BaseModel):
    key: int | str | None = None
    mentions: int = 0
    ai_search_volume: int = 0


class MentionsResponse(BaseModel):
    domain: str
    mentions: int = 0
    ai_search_volume: int = 0
    dimensions: dict[str, list[MentionDimensionRow]] = Field(default_factory=dict)
    meta: Meta


class AiVolumeRequest(BaseModel):
    keywords: list[str] = Field(min_length=1, max_length=20)
    location_name: str = "United States"
    force_live: bool = False


class AiVolumeMonthly(BaseModel):
    year: int | None = None
    month: int | None = None
    volume: int | None = None


class AiVolumeRow(BaseModel):
    keyword: str | None = None
    ai_search_volume: int | None = None
    monthly: list[AiVolumeMonthly] = Field(default_factory=list)


class AiVolumeResponse(BaseModel):
    rows: list[AiVolumeRow]
    meta: Meta


class AskRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=500)
    model_name: str = "gpt-4o-mini"
    force_live: bool = False


class AskResponse(BaseModel):
    model: str | None = None
    answer: str = ""
    input_tokens: int | None = None
    output_tokens: int | None = None
    meta: Meta
