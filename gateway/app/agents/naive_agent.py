"""
Naive Agent — RAG vetorial via mcp-rag (sem ontologia, sem axiomas).

Demonstra empiricamente onde o RAG puro falha: usa documentos com critérios
ambíguos, sem resolução semântica, sem backend determinístico.
"""
from __future__ import annotations

import time
from typing import AsyncIterator

from app.agents.events import WorkstripEvent
from app.llm.azure import llm
from app.mcp.client import MCPRegistry
from app.settings import settings

SYSTEM_NAIVE = (
    "Você é um analista bancário sênior. Com base nos trechos de documentos "
    "fornecidos, responda de forma clara e profissional:\n"
    "  - Apresente o resultado de forma direta, citando os valores e entidades "
    "    encontrados nos documentos.\n"
    "  - Explique brevemente qual critério ou fonte você usou para chegar à conclusão.\n"
    "  - Se os documentos tiverem dados parciais, use-os para dar a resposta "
    "    mais completa possível — seja assertivo.\n"
    "  - Se não houver nenhuma evidência relevante, diga explicitamente que os "
    "    documentos não contêm a informação necessária."
)


async def _retrieve(question: str, k: int = 4) -> list[dict]:
    """Retrieval via mcp-gateway → mcp-rag → Qdrant."""
    reg = MCPRegistry({"agg": settings.mcp_gateway_url})
    try:
        res = await reg.client("agg").call("rag__search", {"query": question, "k": k})
        chunks = res["result"].get("chunks", [])
        return [{"text": c.get("text", ""), "score": float(c.get("score", 0.0))} for c in chunks]
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("mcp-rag search failed: %s", exc)
        return []
    finally:
        for c in reg.clients.values():
            await c.close()


async def run_naive(question: str) -> AsyncIterator[WorkstripEvent]:
    yield WorkstripEvent("agent_started", "naive", "Naive RAG iniciou", {"question": question})

    yield WorkstripEvent("tool_call", "naive", "rag__search",
                         {"args": {"query": question, "k": 4}})
    t0 = time.perf_counter()
    chunks = await _retrieve(question, k=4)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    yield WorkstripEvent(
        "tool_result", "naive", f"{len(chunks)} chunks recuperados",
        {"chunks": chunks, "tool": "rag__search", "routed_via": "mcp-gateway"},
        elapsed_ms=elapsed_ms,
    )

    context = "\n---\n".join(c["text"] for c in chunks)
    if not context.strip():
        context = "(nenhum documento relevante encontrado no índice vetorial)"

    messages = [
        {"role": "system", "content": SYSTEM_NAIVE},
        {"role": "user", "content": f"Pergunta: {question}\n\nDocumentos:\n{context}"},
    ]
    yield WorkstripEvent("thinking", "naive", "LLM gerando resposta com base nos chunks", {})
    res = await llm.chat(messages, naive=True, temperature=0.0)
    yield WorkstripEvent(
        "final", "naive", "Resposta naive",
        {"text": res["content"], "mock": res.get("mock", False)},
    )
