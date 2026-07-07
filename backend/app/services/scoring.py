"""On-Page SEO scoring model.

A transparent, weighted 0–100 rubric computed from locally-extracted page
signals. Independent of the data provider, so the same model applies whether
the page came from DataForSEO `instant_pages` or the local fetch+parse path.

The score is the sum of six weighted components (total 100):

    Title                18
    Meta description     14
    Headings (H1/H2)     16
    Content depth        18
    Readability          12
    Keyword optimization 22

Each component returns a sub-score, a status (good | warn | bad | n/a) and a
short human-readable note, plus issues and recommendations are accumulated so
the UI can show *why* a page scored the way it did and *what to fix*.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PageSignals:
    url: str = ""
    title: str | None = None
    meta_description: str | None = None
    h1: list[str] = field(default_factory=list)
    h2: list[str] = field(default_factory=list)
    word_count: int = 0
    readability_fk: float | None = None
    target_keyword: str | None = None
    keyword_frequency: int = 0
    keyword_density: float = 0.0  # percent (freq * n_tokens / total_words * 100)
    intro_text: str = ""  # first ~120 words of body text
    # Technical / indexability signals (optional; default to neutral).
    noindex: bool = False
    images_total: int = 0
    images_missing_alt: int = 0
    keyword_in_alt: bool = False
    internal_links: int = 0
    external_links: int = 0
    has_schema: bool = False
    title_fits_px: bool | None = None  # None = pixel data unavailable
    meta_fits_px: bool | None = None


def _contains(haystack: str | None, needle: str) -> bool:
    return bool(haystack) and needle in haystack.lower()


def keyword_analysis(s: PageSignals) -> dict | None:
    """Where the target keyword appears + whether its density is healthy."""
    if not s.target_keyword or not s.target_keyword.strip():
        return None
    kw = s.target_keyword.strip().lower()
    slug = kw.replace(" ", "-")
    placements = {
        "in_title": _contains(s.title, kw),
        "in_h1": any(_contains(h, kw) for h in s.h1),
        "in_meta_description": _contains(s.meta_description, kw),
        "in_intro": kw in (s.intro_text or "").lower(),
        "in_url": slug in s.url.lower() or kw.replace(" ", "") in s.url.lower(),
    }
    d = s.keyword_density
    if d <= 0:
        health = "absent"
    elif d < 0.5:
        health = "low"
    elif d <= 2.5:
        health = "optimal"
    elif d <= 4.0:
        health = "high"
    else:
        health = "stuffed"
    return {
        "keyword": kw,
        "frequency": s.keyword_frequency,
        "density": round(d, 2),
        "health": health,
        "placements": placements,
        "placement_count": sum(placements.values()),
    }


def _band(value: float, bands: list[tuple[float, float]], default: float) -> float:
    """Return points for the first (threshold, points) whose threshold <= value."""
    for threshold, points in bands:
        if value >= threshold:
            return points
    return default


def evaluate(s: PageSignals) -> dict:
    """Return {score, subscores[], issues[], recommendations[], keyword_analysis}."""
    subs: list[dict] = []
    issues: list[str] = []
    recs: list[str] = []
    has_kw = bool(s.target_keyword and s.target_keyword.strip())
    kw = (s.target_keyword or "").strip().lower()

    def add(label: str, score: float, mx: int, status: str, note: str) -> None:
        subs.append(
            {"label": label, "score": round(score, 1), "max": mx, "status": status, "note": note}
        )

    # --- Title (18): presence 7, length 5, keyword 6 ---------------------------
    if not s.title:
        add("Title", 0, 18, "bad", "No <title> tag found.")
        issues.append("missing title tag")
        recs.append("Add a descriptive 50–60 character <title> tag.")
    else:
        pts = 7.0
        n = len(s.title)
        if s.title_fits_px is not None:
            if s.title_fits_px:
                pts += 5
                ln_note = f"{n} chars · fits SERP width"
            else:
                pts += 3
                ln_note = f"{n} chars · truncates in SERP"
                issues.append("title truncates in Google (too wide)")
                recs.append("Shorten the title so it fits within ~600px in Google results.")
        elif 30 <= n <= 60:
            pts += 5
            ln_note = f"{n} chars (ideal)"
        elif 15 <= n <= 70:
            pts += 3
            ln_note = f"{n} chars (slightly off 30–60)"
            recs.append("Tune the title length toward 30–60 characters.")
        else:
            pts += 1
            ln_note = f"{n} chars (too {'short' if n < 30 else 'long'})"
            issues.append("title length not ideal (aim 30–60 chars)")
        if not has_kw:
            pts += 6
            kw_note = "no target keyword set"
        elif _contains(s.title, kw):
            pts += 6
            kw_note = "contains target keyword"
        else:
            kw_note = "missing target keyword"
            recs.append("Include your target keyword in the title.")
        add("Title", pts, 18, "good" if pts >= 14 else "warn", f"{ln_note}; {kw_note}")

    # --- Meta description (14): presence 7, length 4, keyword 3 -----------------
    if not s.meta_description:
        add("Meta description", 0, 14, "bad", "No meta description found.")
        issues.append("missing meta description")
        recs.append("Add a 50–160 character meta description.")
    else:
        pts = 7.0
        n = len(s.meta_description)
        if s.meta_fits_px is not None:
            if s.meta_fits_px:
                pts += 4
                ln_note = f"{n} chars · fits SERP width"
            else:
                pts += 2
                ln_note = f"{n} chars · truncates in SERP"
                recs.append("Trim the meta description so it fits within ~920px in Google.")
        elif 50 <= n <= 160:
            pts += 4
            ln_note = f"{n} chars (ideal)"
        elif 30 <= n <= 200:
            pts += 2
            ln_note = f"{n} chars (slightly off 50–160)"
        else:
            pts += 1
            ln_note = f"{n} chars (too {'short' if n < 50 else 'long'})"
            issues.append("meta description length not ideal (aim 50–160 chars)")
        if not has_kw:
            pts += 3
            kw_note = "no target keyword set"
        elif _contains(s.meta_description, kw):
            pts += 3
            kw_note = "contains target keyword"
        else:
            kw_note = "missing target keyword"
            recs.append("Work the target keyword into the meta description.")
        add("Meta description", pts, 14, "good" if pts >= 11 else "warn", f"{ln_note}; {kw_note}")

    # --- Headings (16): h1 present 6, single h1 4, h2s 3, keyword in h1 3 -------
    pts = 0.0
    notes: list[str] = []
    if not s.h1:
        issues.append("missing h1 heading")
        recs.append("Add a single descriptive H1 heading.")
        notes.append("no H1")
    else:
        pts += 6
        if len(s.h1) == 1:
            pts += 4
            notes.append("single H1")
        else:
            issues.append(f"multiple h1 headings ({len(s.h1)})")
            recs.append("Use exactly one H1 per page.")
            notes.append(f"{len(s.h1)} H1s")
    if s.h2:
        pts += 3
        notes.append(f"{len(s.h2)} H2s")
    else:
        recs.append("Break the content up with H2 subheadings.")
        notes.append("no H2s")
    if not has_kw:
        pts += 3
    elif any(_contains(h, kw) for h in s.h1):
        pts += 3
        notes.append("keyword in H1")
    else:
        recs.append("Include the target keyword in the H1.")
    add("Headings", pts, 16, "good" if pts >= 12 else ("warn" if pts >= 6 else "bad"), ", ".join(notes))

    # --- Content depth (18) ----------------------------------------------------
    wc = s.word_count
    depth = _band(wc, [(1500, 18), (800, 15), (500, 12), (300, 8)], 3)
    if wc < 300:
        issues.append(f"thin content ({wc} words; aim 300+)")
        recs.append("Expand the content — aim for at least 600 words of useful copy.")
        d_status = "bad"
    elif wc < 600:
        recs.append("Consider expanding the content past 800 words for competitive topics.")
        d_status = "warn"
    else:
        d_status = "good"
    add("Content depth", depth, 18, d_status, f"{wc} words")

    # --- Readability (12), Flesch–Kincaid grade --------------------------------
    fk = s.readability_fk
    if fk is None:
        add("Readability", 6, 12, "n/a", "Not enough text to compute.")
    elif 6 <= fk <= 12:
        add("Readability", 12, 12, "good", f"FK grade {fk} (clear)")
    elif fk < 6:
        add("Readability", 8, 12, "warn", f"FK grade {fk} (very simple)")
    elif fk <= 16:
        add("Readability", 7, 12, "warn", f"FK grade {fk} (fairly hard)")
        recs.append("Shorten sentences to improve readability.")
    else:
        add("Readability", 4, 12, "bad", f"FK grade {fk} (hard to read)")
        recs.append("Simplify wording and shorten sentences — reading level is high.")

    # --- Keyword optimization (22) ---------------------------------------------
    ka = keyword_analysis(s)
    if not has_kw or ka is None:
        add("Keyword optimization", 15, 22, "n/a", "Set a target keyword for keyword-level scoring.")
    else:
        place_pts = ka["placement_count"] / 5 * 12  # up to 12 for placement
        health = ka["health"]
        health_pts = {"optimal": 10, "low": 6, "high": 6, "stuffed": 3, "absent": 0}[health]
        if health == "absent":
            issues.append("target keyword does not appear in the page text")
            recs.append("Use the target keyword naturally in the body copy.")
        elif health == "stuffed":
            issues.append(f"keyword stuffing risk (density {ka['density']}%)")
            recs.append("Reduce keyword repetition — keep density around 1–2.5%.")
        elif health == "low":
            recs.append("Use the target keyword a little more (aim ~1–2% density).")
        missing = [p.replace("in_", "").replace("_", " ") for p, ok in ka["placements"].items() if not ok]
        if missing:
            recs.append("Add the keyword to: " + ", ".join(missing) + ".")
        total = place_pts + health_pts
        status = "good" if total >= 16 else ("warn" if total >= 9 else "bad")
        add(
            "Keyword optimization",
            total,
            22,
            status,
            f"{ka['placement_count']}/5 placements; density {ka['density']}% ({health})",
        )

    # --- Technical / indexability signals (recommendations, not re-weighted) --
    if s.images_total and s.images_missing_alt:
        recs.append(
            f"Add alt text to {s.images_missing_alt} of {s.images_total} images."
        )
    if has_kw and s.images_total and not s.keyword_in_alt:
        recs.append("Use the target keyword in at least one descriptive image alt.")
    if s.internal_links == 0:
        recs.append("Add internal links to related pages — none were found.")
    if not s.has_schema:
        recs.append("Add JSON-LD structured data (schema.org) for rich-result eligibility.")

    score = round(sum(x["score"] for x in subs))
    score = max(0, min(100, score))

    # A noindexed page cannot rank — flag hard and cap the score.
    if s.noindex:
        issues.insert(0, "page is set to noindex (cannot rank)")
        recs.insert(0, "Remove the `noindex` robots directive so the page can be indexed.")
        score = min(score, 40)

    # De-duplicate recommendations while preserving order.
    seen: set[str] = set()
    recs = [r for r in recs if not (r in seen or seen.add(r))]
    return {
        "score": score,
        "subscores": subs,
        "issues": issues,
        "recommendations": recs,
        "keyword_analysis": ka,
    }
