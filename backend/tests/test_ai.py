from __future__ import annotations

import httpx
import pytest
import respx

from app.core.config import settings
from app.services import ai


@pytest.mark.asyncio
async def test_not_configured_raises(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(ai.AiNotConfigured):
        await ai.seo_insights({"keyword": "x"})


@respx.mock
@pytest.mark.asyncio
async def test_anthropic_parses_model_json(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_model", "claude-haiku-4-5")

    body = {
        "content": [
            {
                "type": "text",
                "text": '{"summary":"Solid foundation, thin content.","suggestions":['
                '{"title":"Expand the /tools page","detail":"220 words; aim for 800+.","priority":"high"},'
                '{"title":"Add internal links","detail":"None found.","priority":"medium"}]}',
            }
        ]
    }
    route = respx.post("https://api.anthropic.com/v1/messages").mock(return_value=httpx.Response(200, json=body))

    out = await ai.seo_insights({"keyword": "seo tools", "domain": "acme.com"})
    assert route.called
    assert out["summary"].startswith("Solid foundation")
    assert len(out["suggestions"]) == 2 and out["suggestions"][0]["priority"] == "high"
    assert route.calls.last.request.headers["anthropic-version"] == "2023-06-01"


@respx.mock
@pytest.mark.asyncio
async def test_gemini_free_provider(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "g-test")
    monkeypatch.setattr(settings, "gemini_model", "gemini-2.5-flash")

    body = {
        "candidates": [
            {"content": {"parts": [{"text": '{"summary":"Good.","suggestions":[{"title":"Fix titles","detail":"x","priority":"high"}]}'}]}}
        ]
    }
    route = respx.post(url__regex=r"https://generativelanguage\.googleapis\.com/.*").mock(
        return_value=httpx.Response(200, json=body)
    )

    out = await ai.seo_insights({"keyword": "x", "domain": "y.com"})
    assert route.called
    assert out["summary"] == "Good."
    assert out["suggestions"][0]["title"] == "Fix titles"
    assert out["model"] == "gemini-2.5-flash"


@respx.mock
@pytest.mark.asyncio
async def test_gemini_quota_falls_back_to_lite(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "g-test")
    monkeypatch.setattr(settings, "gemini_model", "gemini-2.5-flash")
    monkeypatch.setattr(settings, "gemini_fallback_model", "gemini-2.5-flash-lite")
    monkeypatch.setattr(ai, "_RETRY_DELAYS", (0.0, 0.0))  # no sleeping in tests

    respx.post(url__regex=r".*gemini-2\.5-flash:generateContent.*").mock(
        return_value=httpx.Response(429, json={"error": {"message": "quota exceeded"}})
    )
    lite = respx.post(url__regex=r".*gemini-2\.5-flash-lite:generateContent.*").mock(
        return_value=httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": '{"summary":"ok","suggestions":[]}'}]}}]
        })
    )

    out = await ai.seo_insights({"keyword": "x"})
    assert lite.called
    assert out["model"] == "gemini-2.5-flash-lite"
    assert out["summary"] == "ok"


@respx.mock
@pytest.mark.asyncio
async def test_gemini_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(ai.AiNotConfigured):
        await ai.seo_insights({"keyword": "x"})


@respx.mock
@pytest.mark.asyncio
async def test_upstream_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(400, json={"error": {"message": "bad model"}})
    )
    with pytest.raises(ai.AiError):
        await ai.seo_insights({"keyword": "x"})


@respx.mock
@pytest.mark.asyncio
async def test_tolerates_non_json_reply(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "no json here"}]})
    )
    out = await ai.seo_insights({"keyword": "x"})
    assert out["suggestions"] == [] and "no json" in out["summary"]
