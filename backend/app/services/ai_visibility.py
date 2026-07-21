"""AI Visibility checker — background job that, for a list of keywords, asks
whether a domain is cited in Google's AI Overview and AI Mode answers.

Runs as a background asyncio task (like the site crawler): the API returns a job
id and the client polls. Each keyword is one or two billed SERP calls routed
through the cost engine, so repeats are cached/free. The two surfaces per
keyword run concurrently and keywords are processed with bounded concurrency —
each billed call gets its own DB session via `usage.metered_parallel` (one
AsyncSession is not safe for concurrent use).
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

from app.core.logging import log
from app.db.models import User
from app.db.session import SessionLocal
from app.integrations.dataforseo import ai_visibility as aiv
from app.services import engine, ranking, usage

_MAX_JOBS = 50
_JOBS: dict[str, "CheckJob"] = {}
_gate: asyncio.Semaphore | None = None


@dataclass(slots=True)
class CheckJob:
    id: str
    user_id: str
    domain: str
    keywords: list[str]
    location_code: int
    language_code: str
    device: str
    include_ai_mode: bool
    force_live: bool
    progress: str = "queued"
    checked: int = 0
    total: int = 0
    rows: list[dict] = field(default_factory=list)
    summary: dict = field(default_factory=dict)
    error: str | None = None
    started_at: float = field(default_factory=time.monotonic)


def _remember(job: CheckJob) -> None:
    _JOBS[job.id] = job
    if len(_JOBS) > _MAX_JOBS:
        for jid in sorted(_JOBS, key=lambda k: _JOBS[k].started_at)[: len(_JOBS) - _MAX_JOBS]:
            _JOBS.pop(jid, None)


def get_job(job_id: str) -> CheckJob | None:
    return _JOBS.get(job_id)


async def _check_one(user, job: CheckJob, kw: str, domain: str) -> dict:
    loc, lang, dev = job.location_code, job.language_code, job.device
    # The two surfaces are independent — one concurrent round-trip, not two.
    calls: list[tuple] = [(
        "serp.ai_overview",
        {"keyword": kw, "location_code": loc, "language_code": lang,
         "device": dev, "surface": "ai_overview"},
        engine.TTL["serp"],
        lambda: aiv.ai_overview(kw, loc, lang, dev),
    )]
    if job.include_ai_mode:
        calls.append((
            "serp.ai_mode",
            {"keyword": kw, "location_code": loc, "language_code": lang,
             "device": dev, "surface": "ai_mode"},
            engine.TTL["serp"],
            lambda: aiv.ai_mode(kw, loc, lang, dev),
        ))
    # Quota was asserted once in _run; each call records on its own session.
    results = await usage.metered_parallel(
        None, user, calls, force_live=job.force_live, check_quota=False
    )
    cost = sum(r.cost_cents for r in results)

    ov_parsed = aiv.parse_surface(results[0].data)
    ov_cit = aiv.find_citation(ov_parsed["references"], domain)

    mode_parsed = {"present": False, "references": []}
    mode_cit = {"cited": False, "url": None, "position": None}
    if job.include_ai_mode:
        mode_parsed = aiv.parse_surface(results[1].data)
        mode_cit = aiv.find_citation(mode_parsed["references"], domain)

    cited_domains: list[str] = []
    for r in ov_parsed["references"] + mode_parsed["references"]:
        d = r.get("domain")
        if d and d not in cited_domains:
            cited_domains.append(d)

    return {
        "row": {
            "keyword": kw,
            "ai_overview_present": ov_parsed["present"],
            "ai_overview": ov_cit,
            "ai_mode_present": mode_parsed["present"],
            "ai_mode": mode_cit,
            "cited_domains": cited_domains[:12],
        },
        "cost": cost,
    }


async def _run(job: CheckJob) -> None:
    global _gate
    if _gate is None:
        _gate = asyncio.Semaphore(2)
    async with _gate:
        job.progress = "in_progress"
        domain = ranking.normalize_domain(job.domain)
        total_cost = 0
        async with SessionLocal() as db:
            user = await db.get(User, job.user_id)
            if user is None:
                job.progress = "error"
                job.error = "User not found."
                return
            # One quota gate for the whole job; the billed calls themselves run
            # on their own sessions inside metered_parallel.
            await usage.assert_within_quota(db, user)

        # Keywords are independent — process them with bounded concurrency.
        # ponytail: 3 in flight is kind to DataForSEO; raise if runs feel slow.
        kw_gate = asyncio.Semaphore(3)

        async def _guarded(kw: str) -> dict:
            async with kw_gate:
                try:
                    out = await _check_one(user, job, kw, domain)
                except Exception as exc:  # one bad keyword must not kill the run
                    log.info("ai_visibility_keyword_failed", keyword=kw, error=str(exc))
                    out = {
                        "row": {
                            "keyword": kw, "ai_overview_present": False,
                            "ai_overview": {"cited": False, "url": None, "position": None},
                            "ai_mode_present": False,
                            "ai_mode": {"cited": False, "url": None, "position": None},
                            "cited_domains": [],
                        },
                        "cost": 0,
                    }
                job.checked += 1
                return out

        outs = await asyncio.gather(*(_guarded(kw) for kw in job.keywords))
        for out in outs:
            job.rows.append(out["row"])
            total_cost += out["cost"]

        job.summary = {
            "keywords": len(job.rows),
            "ai_overview_present": sum(1 for r in job.rows if r["ai_overview_present"]),
            "ai_overview_cited": sum(1 for r in job.rows if r["ai_overview"]["cited"]),
            "ai_mode_cited": sum(1 for r in job.rows if r["ai_mode"]["cited"]),
            "cost_cents": total_cost,
        }
        job.progress = "finished"
        log.info("ai_visibility_done", domain=job.domain, keywords=len(job.rows),
                 cited=job.summary["ai_overview_cited"] + job.summary["ai_mode_cited"])


def start_check(
    job_id: str, user_id: str, domain: str, keywords: list[str],
    location_code: int, language_code: str, device: str,
    include_ai_mode: bool, force_live: bool,
) -> CheckJob:
    # De-dupe + normalise keywords, preserve order.
    seen: set[str] = set()
    clean: list[str] = []
    for k in keywords:
        kk = k.strip().lower()
        if kk and kk not in seen:
            seen.add(kk)
            clean.append(kk)

    job = CheckJob(
        id=job_id, user_id=user_id, domain=domain, keywords=clean,
        location_code=location_code, language_code=language_code, device=device,
        include_ai_mode=include_ai_mode, force_live=force_live, total=len(clean),
    )
    _remember(job)

    async def _runner() -> None:
        try:
            await _run(job)
        except Exception as exc:
            job.progress = "error"
            job.error = str(exc)
            log.error("ai_visibility_failed", domain=domain, error=repr(exc))

    asyncio.create_task(_runner())
    return job
