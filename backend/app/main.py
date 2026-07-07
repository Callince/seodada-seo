import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.session import engine, init_models
from app.integrations.dataforseo.client import dfs_client
from app.services import crawler, density, providers
from app.services.cache_backend import cache_backend


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await init_models()  # dev convenience; production relies on Alembic migrations

    scheduler_task: asyncio.Task | None = None
    if settings.scheduler_enabled:
        from app.services.scheduler import scheduler_loop

        scheduler_task = asyncio.create_task(
            scheduler_loop(settings.scheduler_interval_seconds)
        )

    yield

    if scheduler_task is not None:
        scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler_task
    await dfs_client.close()
    await density.close()
    await crawler.close()
    await cache_backend.close()
    await engine.dispose()


app = FastAPI(title="SEO Intelligence API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=512)

register_error_handlers(app)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {
        "status": "ok",
        "sandbox": settings.dfs_use_sandbox,
        "providers": providers.active(),
    }
