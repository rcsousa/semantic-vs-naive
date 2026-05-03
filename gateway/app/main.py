"""FastAPI gateway — orquestra os 2 agentes e expõe SSE para o frontend."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import compare, inspect
from app.settings import settings

app = FastAPI(title="Semantic Agents Demo — Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compare.router)
app.include_router(inspect.router)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "azure_configured": settings.azure_configured,
        "mode": "real" if settings.azure_configured else "mock",
    }
