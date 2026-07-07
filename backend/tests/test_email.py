from __future__ import annotations

import pytest

from app.services import email


def test_build_report_email_contains_key_data():
    subject, html = email.build_report_email(
        "acme.com", "seo tools",
        {"health_score": 88, "findings": ["Ranks for 1,200 keywords."], "recommendations": ["Add H2s."]},
    )
    assert "acme.com" in subject and "seo tools" in subject
    assert "88/100" in html
    assert "Ranks for 1,200 keywords." in html
    assert "Add H2s." in html


def test_build_report_email_includes_ai_section_when_present():
    result = {
        "health_score": 70,
        "findings": ["f1"],
        "ai": {
            "summary": "Solid base, thin content.",
            "suggestions": [
                {"title": "Expand /tools page", "detail": "220 words; aim for 800+.", "priority": "high"},
                {"title": "Add internal links", "priority": "medium"},
            ],
        },
    }
    _, html = email.build_report_email("acme.com", None, result)
    assert "AI SEO Advisor" in html
    assert "Solid base, thin content." in html
    assert "[HIGH]" in html and "Expand /tools page" in html
    assert "aim for 800+" in html

    # And absent when there is no ai block
    _, html2 = email.build_report_email("acme.com", None, {"health_score": 70})
    assert "AI SEO Advisor" not in html2


@pytest.mark.asyncio
async def test_send_email_is_noop_when_unconfigured(monkeypatch):
    monkeypatch.setattr(email.settings, "smtp_host", "")
    called = {"n": 0}
    monkeypatch.setattr(email, "_send_sync", lambda *a: called.__setitem__("n", called["n"] + 1))
    assert await email.send_email("a@b.com", "s", "<p>x</p>") is False
    assert called["n"] == 0  # never attempted a connection


@pytest.mark.asyncio
async def test_send_email_dispatches_when_configured(monkeypatch):
    monkeypatch.setattr(email.settings, "smtp_host", "smtp.example.com")
    sent: dict = {}

    def fake(to, subject, html):
        sent.update(to=to, subject=subject, html=html)

    monkeypatch.setattr(email, "_send_sync", fake)
    ok = await email.send_email("user@x.com", "Subj", "<b>hi</b>")
    assert ok is True
    assert sent["to"] == "user@x.com" and sent["subject"] == "Subj"
