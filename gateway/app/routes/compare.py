"""Endpoint principal: roda os dois agentes em paralelo via SSE."""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.naive_agent import run_naive
from app.agents.semantic_agent import run_semantic
from app.agents.events import WorkstripEvent
from app.mcp.client import MCPRegistry
from app.settings import settings

router = APIRouter(prefix="/api", tags=["compare"])


class AskBody(BaseModel):
    question: str
    scenario_id: str | None = None


def _sse(ev: WorkstripEvent) -> str:
    return f"event: {ev.type}\ndata: {json.dumps(ev.to_dict(), ensure_ascii=False, default=str)}\n\n"


async def _run_and_capture(gen: AsyncIterator[WorkstripEvent], queue: asyncio.Queue):
    final_text = None
    try:
        async for ev in gen:
            await queue.put(ev)
            if ev.type == "final":
                final_text = ev.detail.get("text")
    except Exception as e:
        await queue.put(WorkstripEvent("error", "system", f"agent error: {e}", {}))
    finally:
        await queue.put(WorkstripEvent("__done__", "system", "agent done",
                                       {"final": final_text}))


@router.post("/ask")
async def ask(body: AskBody):
    queue: asyncio.Queue = asyncio.Queue()

    async def stream() -> AsyncIterator[str]:
        # marcador de início
        yield _sse(WorkstripEvent("started", "system", "iniciando comparativo",
                                  {"question": body.question, "scenario_id": body.scenario_id,
                                   "mock_mode": not settings.azure_configured}))
        naive_task = asyncio.create_task(_run_and_capture(run_naive(body.question), queue))
        sem_task = asyncio.create_task(_run_and_capture(run_semantic(body.question), queue))

        finals = {"naive": None, "semantic": None}
        done_count = 0
        while done_count < 2:
            try:
                ev: WorkstripEvent = await asyncio.wait_for(queue.get(), timeout=120)
            except asyncio.TimeoutError:
                break
            if ev.type == "__done__":
                finals[ev.agent if ev.agent in finals else "_"] = ev.detail.get("final")
                done_count += 1
                continue
            if ev.type == "final":
                finals[ev.agent] = ev.detail.get("text")
            yield _sse(ev)

        # Eval em tempo real, se há scenario_id
        if body.scenario_id:
            reg = MCPRegistry({"agg": settings.mcp_gateway_url})
            try:
                for label in ("naive", "semantic"):
                    text = finals.get(label) or ""
                    res = await reg.client("agg").call(
                        "eval__score", {"id": body.scenario_id, "agent_answer": text, "agent_label": label}
                    )
                    yield _sse(WorkstripEvent(
                        "eval", label, f"score {label}",
                        {"output": res["result"], "tool": "eval__score"}
                    ))
            finally:
                for c in reg.clients.values():
                    await c.close()

        yield _sse(WorkstripEvent("done", "system", "comparativo finalizado", {"finals": finals}))
        await asyncio.gather(naive_task, sem_task, return_exceptions=True)

    return StreamingResponse(stream(), media_type="text/event-stream")
