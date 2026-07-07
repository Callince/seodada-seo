from __future__ import annotations

from pydantic import BaseModel, Field


class AiInsightsRequest(BaseModel):
    # Compact analysis context (scores, findings, competitors, sentiment, …).
    context: dict = Field(default_factory=dict)


class AiSuggestion(BaseModel):
    title: str
    detail: str = ""
    priority: str = "medium"  # high | medium | low


class AiInsightsResponse(BaseModel):
    summary: str = ""
    suggestions: list[AiSuggestion] = []
    model: str
