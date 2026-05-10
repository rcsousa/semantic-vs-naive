"""
Rota /api/govern — pipeline de governança em runtime.

Sequência:
  1. Calcular  — run_semantic propagado para SSE sem modificação
  2. Julgar    — judge__evaluate via MCP gateway
  3. Killswitch — lógica pura (RAGAS + judge + variância)
  4. Decidir   — final_governed (entrega) ou escalated (escalação humana)

Eventos novos emitidos (além dos eventos do agente semântico):
  judge_started, judge_result, killswitch_evaluated, final_governed, escalated

O agente naive não é executado nesta rota — o módulo 2 descartou o naive
como agente de produção candidato.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.events import WorkstripEvent
from app.agents.semantic_agent import run_semantic
from app.governance.killswitch import Killswitch, KillswitchConfig
from app.governance.trail import AuditTrail
from app.mcp.client import MCPRegistry
from app.settings import settings

router = APIRouter(prefix="/api", tags=["govern"])

_killswitch = Killswitch()  # config default


class GovernBody(BaseModel):
    question: str
    scenario_id: str | None = None


def _sse(ev: WorkstripEvent) -> str:
    return f"event: {ev.type}\ndata: {json.dumps(ev.to_dict(), ensure_ascii=False, default=str)}\n\n"


def _gov_event(ev_type: str, label: str, detail: dict) -> str:
    ev = WorkstripEvent(ev_type, "governance", label, detail)
    return _sse(ev)


def _extract_governance_state(events: list[WorkstripEvent]) -> dict:
    """Extrai axiom_data, instances e final_text do histórico de eventos do agente."""
    axiom_id: str | None = None
    axiom_data: dict = {}
    instances: list[dict] = []
    final_text: str = ""

    for ev in events:
        if ev.type == "final":
            final_text = ev.detail.get("text", "")
            if ev.detail.get("axiom") and not axiom_id:
                axiom_id = ev.detail["axiom"]

        elif ev.type == "tool_call":
            args = ev.detail.get("args", {})
            # captura axiom_id de chamadas ao ontology
            if "axiom_id" in args and not axiom_id:
                axiom_id = args["axiom_id"]

        elif ev.type == "tool_result":
            tool = ev.detail.get("tool", "")
            output = ev.detail.get("output", {})
            if "ontology__get_axiom" in tool:
                # captura definição do axioma
                axiom_data = output if isinstance(output, dict) else {}
                if axiom_id and not axiom_data.get("id"):
                    axiom_data["id"] = axiom_id
            if "metrics__compute" in tool and isinstance(output, dict):
                rows = output.get("rows", [])
                if rows:
                    instances = rows  # últimas instâncias ganham

    if axiom_id and not axiom_data.get("id"):
        axiom_data["id"] = axiom_id

    return {
        "axiom_id": axiom_id,
        "axiom_data": axiom_data,
        "instances": instances,
        "final_text": final_text,
    }


_NUMERIC_FIELDS = ("spread", "npl_ratio", "exposure", "ltv",
                   "outstanding_principal", "portfolio",
                   "active_customers", "checking_accounts")


def _build_axiom_for_judge(axiom_id: str | None, axiom_data: dict, instances: list) -> dict:
    """Constrói o objeto axioma enviado ao judge.

    Axiomas AX-* passam pela ontologia e já chegam com definição/fórmula.
    Métricas Metric:* não passam pela ontologia — geramos contexto a partir
    do próprio ID e das instâncias para que o judge possa verificar.
    """
    base = dict(axiom_data) if axiom_data else {}
    if axiom_id and not base.get("id"):
        base["id"] = axiom_id

    if not axiom_id:
        return base

    # Métricas determinísticas sem entrada na ontologia
    if axiom_id.startswith("Metric:") and not base.get("formula"):
        numeric_field = next(
            (f for f in _NUMERIC_FIELDS if instances and f in instances[0]),
            None,
        )
        n = len(instances)
        field_desc = f"'{numeric_field}'" if numeric_field else "valor numérico principal"
        base["definition"] = (
            f"{axiom_id}: métrica calculada via SQL determinístico. "
            f"Cada instância abaixo é um registro real do backend com seu {field_desc} individual."
        )
        base["formula"] = (
            f"Resultado esperado = média aritmética dos {n} valores de {field_desc} "
            f"nas instâncias retornadas. Verifique se a resposta do agente bate com "
            f"essa média dentro de tolerância de arredondamento."
        )

    return base


@router.post("/govern")
async def govern(body: GovernBody):
    async def stream() -> AsyncIterator[str]:
        trail = AuditTrail(question=body.question)
        agent_events: list[WorkstripEvent] = []

        yield _gov_event("started", "iniciando governança", {
            "question": body.question,
            "scenario_id": body.scenario_id,
            "mock_mode": not settings.azure_configured,
        })

        # ── 1. Calcular ──────────────────────────────────────────────────────
        t0 = time.perf_counter()
        async for ev in run_semantic(body.question):
            agent_events.append(ev)
            yield _sse(ev)
        calc_ms = int((time.perf_counter() - t0) * 1000)

        state = _extract_governance_state(agent_events)
        trail.add_step(
            "calculate",
            inputs={"question": body.question},
            outputs={
                "axiom_id": state["axiom_id"],
                "instance_count": len(state["instances"]),
                "answer_preview": state["final_text"][:120],
            },
            duration_ms=calc_ms,
        )

        # ── 2. Julgar ────────────────────────────────────────────────────────
        yield _gov_event("judge_started", "judge avaliando resposta", {
            "axiom_id": state["axiom_id"],
            "instance_count": len(state["instances"]),
        })

        judge_result = {"verdict": "insufficient_evidence", "reasoning": "Judge não executado.", "confidence": 0.0}
        reg = MCPRegistry({"agg": settings.mcp_gateway_url})
        t1 = time.perf_counter()
        try:
            axiom_for_judge = _build_axiom_for_judge(
                state["axiom_id"], state["axiom_data"], state["instances"]
            )
            jr = await reg.client("agg").call("judge__evaluate", {
                "question": body.question,
                "axiom": axiom_for_judge,
                "instances": state["instances"],
                "agent_response": state["final_text"],
            })
            if not jr["isError"]:
                judge_result = jr["result"]
        except Exception as exc:
            judge_result = {
                "verdict": "insufficient_evidence",
                "reasoning": f"Erro ao chamar judge: {type(exc).__name__}",
                "confidence": 0.0,
            }
        judge_ms = int((time.perf_counter() - t1) * 1000)

        trail.add_step(
            "judge",
            inputs={"axiom_id": state["axiom_id"], "instance_count": len(state["instances"])},
            outputs=judge_result,
            duration_ms=judge_ms,
        )
        yield _gov_event("judge_result", f"verdict: {judge_result['verdict']}", {
            "verdict": judge_result["verdict"],
            "reasoning": judge_result.get("reasoning", ""),
            "confidence": judge_result.get("confidence", 0.0),
            "axiom_id": state["axiom_id"],
            "instance_count": len(state["instances"]),
        })

        # ── 3. Killswitch ────────────────────────────────────────────────────
        ragas_score: float | None = None
        if body.scenario_id:
            try:
                er = await reg.client("agg").call("eval__score", {
                    "id": body.scenario_id,
                    "agent_answer": state["final_text"],
                    "agent_label": "semantic",
                })
                if not er["isError"]:
                    ragas_score = er["result"].get("ragas_score")
            except Exception:
                pass

        ks = _killswitch.evaluate(
            judge_verdict=judge_result["verdict"],
            ragas_score=ragas_score,
            instances=state["instances"],
        )

        trail.add_step(
            "killswitch",
            inputs={
                "judge_verdict": judge_result["verdict"],
                "ragas_score": ragas_score,
                "instance_count": len(state["instances"]),
            },
            outputs={
                "armed": ks.armed,
                "triggers": [
                    {"code": t.code, "threshold": t.threshold,
                     "observed": t.observed, "detail": t.detail}
                    for t in ks.triggers
                ],
            },
        )
        yield _gov_event("killswitch_evaluated", f"{'armed' if ks.armed else 'passive'}", {
            "armed": ks.armed,
            "ragas_score": ragas_score,
            "triggers": [
                {"code": t.code, "threshold": t.threshold,
                 "observed": t.observed, "detail": t.detail}
                for t in ks.triggers
            ],
        })

        # ── 4. Decisão final ─────────────────────────────────────────────────
        trail_dict = trail.to_dict()
        rep_hash = trail_dict["hash"]

        if ks.armed:
            trail.add_step("escalate", inputs={}, outputs={"triggers": len(ks.triggers)})
            trail_dict = trail.to_dict()
            yield _gov_event("escalated", "resposta escalada para revisão humana", {
                "triggers": [
                    {"code": t.code, "threshold": t.threshold,
                     "observed": t.observed, "detail": t.detail}
                    for t in ks.triggers
                ],
                "reproducibility_hash": trail_dict["hash"],
                "trail": trail_dict,
            })
        else:
            trail.add_step("respond", inputs={}, outputs={"answer_length": len(state["final_text"])})
            trail_dict = trail.to_dict()
            yield _gov_event("final_governed", "resposta entregue", {
                "text": state["final_text"],
                "reproducibility_hash": trail_dict["hash"],
                "trail": trail_dict,
            })

        await asyncio.gather(*[c.close() for c in reg.clients.values()], return_exceptions=True)

    return StreamingResponse(stream(), media_type="text/event-stream")
