"""Local, $0 content sentiment + emotion analysis (VADER).

Given a corpus of SERP rows for a keyword (title + snippet per result), VADER
scores each as positive / neutral / negative, and a small emotion lexicon
estimates connotation mix. Produces the same shape as the DataForSEO Content
Analysis summary so the route/response model is unchanged.
"""
from __future__ import annotations

import re

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()
_WORD = re.compile(r"[a-z']+")

# Compact connotation lexicon — a real (if lightweight) emotion signal.
_EMOTION_LEXICON: dict[str, set[str]] = {
    "anger": {
        "angry", "anger", "rage", "furious", "hate", "hateful", "outrage",
        "annoyed", "frustrated", "frustrating", "irritated", "mad", "scam",
        "terrible", "awful", "worst", "broken", "fail", "failure", "complaint",
    },
    "happiness": {
        "happy", "happiness", "joy", "joyful", "great", "excellent", "amazing",
        "wonderful", "fantastic", "delighted", "pleased", "glad", "best",
        "love", "awesome", "perfect", "satisfied", "recommend", "winner",
    },
    "love": {
        "love", "loved", "loving", "adore", "affection", "heart", "romantic",
        "cherish", "devoted", "passion", "passionate", "favorite", "beloved",
    },
    "sadness": {
        "sad", "sadness", "unhappy", "depressed", "depressing", "grief",
        "disappointed", "disappointing", "regret", "sorrow", "miserable",
        "cry", "tragic", "loss", "lonely", "heartbroken",
    },
    "fun": {
        "fun", "funny", "exciting", "excited", "enjoy", "enjoyable", "play",
        "playful", "entertaining", "hilarious", "cool", "awesome", "thrill",
        "adventure", "celebrate", "party",
    },
}


def classify(text: str) -> str:
    compound = _analyzer.polarity_scores(text or "")["compound"]
    if compound >= 0.05:
        return "positive"
    if compound <= -0.05:
        return "negative"
    return "neutral"


def _emotion_mix(corpus: str) -> dict[str, float | None]:
    tokens = _WORD.findall(corpus.lower())
    if not tokens:
        return {e: None for e in _EMOTION_LEXICON}
    raw = {
        emotion: sum(1 for t in tokens if t in words)
        for emotion, words in _EMOTION_LEXICON.items()
    }
    total = sum(raw.values())
    if total == 0:
        return {e: 0.0 for e in _EMOTION_LEXICON}
    return {e: round(c / total, 3) for e, c in raw.items()}


def analyze_corpus(items: list[dict]) -> dict:
    """`items` are SERP rows (title/description/url/domain). Returns a Content
    Analysis-shaped dict: total_count, sentiment, connotations, citations."""
    texts: list[str] = []
    citations: list[dict] = []
    counts = {"positive": 0, "negative": 0, "neutral": 0}

    for it in items:
        title = (it.get("title") or "").strip()
        snippet = (it.get("description") or "").strip()
        blob = f"{title}. {snippet}".strip(". ")
        if not blob:
            continue
        texts.append(blob)
        counts[classify(blob)] += 1
        if it.get("url"):
            citations.append(
                {
                    "domain": it.get("domain"),
                    "url": it.get("url"),
                    "title": title or None,
                    "snippet": snippet or None,
                }
            )

    total = len(texts)
    if total == 0:
        return {
            "total_count": 0,
            "sentiment": {"positive": None, "negative": None, "neutral": None},
            "connotations": {e: None for e in _EMOTION_LEXICON},
            "citations": [],
        }

    return {
        "total_count": total,
        "sentiment": {k: round(v / total, 3) for k, v in counts.items()},
        "connotations": _emotion_mix(" ".join(texts)),
        "citations": citations,
    }
