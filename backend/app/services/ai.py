"""AI-generated SEO insights — provider-agnostic.

Supports three backends, selected by `ai_provider`:
  * anthropic — Claude Messages API (paid)
  * gemini    — Google Gemini (free tier; key from aistudio.google.com)
  * ollama    — local models via Ollama (free, runs on your machine)

All return the same shape: {summary, suggestions[], model}. The system prompt
and JSON parsing are shared; only the HTTP call differs per provider. Gracefully
raises AiNotConfigured when the chosen provider isn't set up.
"""
from __future__ import annotations

import asyncio
import json

import httpx

from app.core.config import settings
from app.core.logging import log

_TIMEOUT = httpx.Timeout(90.0)
# Transient statuses worth retrying — free tiers (Gemini especially) throw
# brief 429/503 "high demand" spikes that clear within seconds.
_RETRY_STATUSES = {429, 500, 503, 529}
_RETRY_DELAYS = (1.5, 4.0)  # seconds between attempts (3 attempts total)


async def _post_with_retry(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    """POST with automatic retry on transient provider errors."""
    for attempt, delay in enumerate((*_RETRY_DELAYS, None)):
        resp = await client.post(url, **kwargs)
        if resp.status_code not in _RETRY_STATUSES or delay is None:
            return resp
        log.info("ai_retry", status=resp.status_code, attempt=attempt + 1)
        await asyncio.sleep(delay)
    return resp  # pragma: no cover — loop always returns
# Generous output budget: 8 suggestions with detailed sentences can exceed
# 1200 tokens, and a truncated reply breaks JSON parsing (raw-text fallback).
_MAX_TOKENS = 3000

_SYSTEM = (
    "You are an elite SEO consultant. You are given structured analysis data about a website and a "
    "target keyword — SERP results, on-page content scores, keyword metrics, competitors, content "
    "sentiment, and automated findings. Produce a brief executive summary and a prioritized list of "
    "specific, actionable recommendations to improve search rankings and content. Reference the data "
    "concretely (numbers, page paths, competitor names). "
    "Respond with ONLY minified JSON of this exact shape and nothing else: "
    '{"summary":"<2-3 sentences>","suggestions":[{"title":"<short imperative>","detail":"<1-2 '
    'specific sentences>","priority":"high|medium|low"}]}. '
    "Return 4 to 8 suggestions, highest priority first. No markdown, no text outside the JSON."
)


class AiError(Exception):
    pass


class AiNotConfigured(AiError):
    pass


def _user_content(context: dict) -> str:
    return "Analysis data (JSON):\n" + json.dumps(context, default=str)


def _extract_json(text: str) -> dict:
    t = (text or "").strip()
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(t[start : end + 1])
        except (ValueError, TypeError):
            pass
    return {"summary": (text or "")[:500], "suggestions": []}


def _normalize(text: str, model: str) -> dict:
    parsed = _extract_json(text)
    suggestions = [
        {
            "title": s.get("title", ""),
            "detail": s.get("detail", ""),
            "priority": s.get("priority") if s.get("priority") in ("high", "medium", "low") else "medium",
        }
        for s in (parsed.get("suggestions") or [])
        if s.get("title")
    ]
    return {"summary": str(parsed.get("summary") or ""), "suggestions": suggestions, "model": model}


def _http_error(provider: str, exc: httpx.HTTPStatusError) -> AiError:
    try:
        body = exc.response.json()
        msg = (body.get("error") or {}).get("message") or str(body)[:200]
    except Exception:  # noqa: BLE001
        msg = exc.response.text[:200]
    log.error("ai_http_error", provider=provider, status=exc.response.status_code, message=msg)
    return AiError(f"AI request failed ({provider}): {msg or exc.response.status_code}")


async def _anthropic(context: dict) -> dict:
    if not settings.anthropic_api_key.strip():
        raise AiNotConfigured("Anthropic is not configured — set ANTHROPIC_API_KEY.")
    payload = {
        "model": settings.anthropic_model,
        "max_tokens": _MAX_TOKENS,
        "system": [{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": _user_content(context)}],
    }
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await _post_with_retry(client, "https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise _http_error("anthropic", exc) from exc
        data = resp.json()
    text = "".join(b.get("text", "") for b in (data.get("content") or []) if b.get("type") == "text")
    return _normalize(text, settings.anthropic_model)


async def _gemini_request(client: httpx.AsyncClient, model: str, context: dict) -> httpx.Response:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={settings.gemini_api_key}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": _user_content(context)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "maxOutputTokens": _MAX_TOKENS,
            # Gemini 2.5 models "think" by default and thinking tokens count
            # against maxOutputTokens — disable thinking for this small JSON
            # task so the whole budget goes to the actual answer.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    return await _post_with_retry(client, url, json=payload, headers={"content-type": "application/json"})


async def _gemini(context: dict) -> dict:
    if not settings.gemini_api_key.strip():
        raise AiNotConfigured("Gemini is not configured — set GEMINI_API_KEY (free at aistudio.google.com).")
    model = settings.gemini_model
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await _gemini_request(client, model, context)
        # Free-tier quota exhausted on the primary model? Fall back to the
        # lite variant, which has its own (larger) free quota.
        fallback = settings.gemini_fallback_model.strip()
        if resp.status_code == 429 and fallback and fallback != model:
            log.info("ai_gemini_fallback", from_model=model, to_model=fallback)
            model = fallback
            resp = await _gemini_request(client, model, context)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise _http_error("gemini", exc) from exc
        data = resp.json()
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")) or [{}]
    text = "".join(p.get("text", "") for p in parts)
    return _normalize(text, model)


async def _ollama(context: dict) -> dict:
    base = settings.ollama_base_url.strip().rstrip("/")
    if not base:
        raise AiNotConfigured("Ollama is not configured — set OLLAMA_BASE_URL.")
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _user_content(context)},
        ],
        "stream": False,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await _post_with_retry(client, f"{base}/api/chat", json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise _http_error("ollama", exc) from exc
        except httpx.HTTPError as exc:
            raise AiError(f"AI request failed (ollama): {exc}. Is Ollama running?") from exc
        data = resp.json()
    text = (data.get("message") or {}).get("content", "")
    return _normalize(text, f"ollama/{settings.ollama_model}")


_PROVIDERS = {"anthropic": _anthropic, "gemini": _gemini, "ollama": _ollama}


async def seo_insights(context: dict) -> dict:
    provider = settings.ai_provider.strip().lower()
    fn = _PROVIDERS.get(provider)
    if fn is None:
        raise AiNotConfigured(f"Unknown AI provider '{provider}'. Use anthropic, gemini, or ollama.")
    try:
        result = await fn(context)
    except httpx.HTTPError as exc:  # non-status network errors
        log.error("ai_request_error", provider=provider, error=str(exc))
        raise AiError(f"AI request failed ({provider}): {exc}") from exc
    log.info("ai_insights", provider=provider, suggestions=len(result["suggestions"]))
    return result
