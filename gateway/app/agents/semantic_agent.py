"""
Semantic Agent — agente "ontology-aware" que orquestra MCP tools.

Pipeline canônico:
  1. disambig.suggest(text)            -- detecta termos ambíguos
  2. para cada termo: disambig.resolve_term(term)
  3. para cada axioma identificado: ontology.get_axiom(id)
  4. metrics.compute(id)                -- ground truth determinístico
  5. (se necessário) kg.cypher_readonly  -- traversals
  6. LLM redige a resposta CITANDO os axiomas e os números do backend

Em modo MOCK (sem Azure), o orquestrador segue determinísticamente o pipeline
acima usando heurísticas — assim a demo funciona end-to-end sem chave.
"""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

from app.agents.events import WorkstripEvent
from app.llm.azure import llm
from app.mcp.client import MCPRegistry
from app.settings import settings

SYSTEM_SEMANTIC = (
    "Você é um especialista em crédito bancário com acesso a um knowledge graph "
    "e a um backend determinístico de métricas. Siga este protocolo:\n"
    "  1) Use disambig.suggest e disambig.resolve_term para mapear termos.\n"
    "  2) Use ontology.get_axiom para entender a regra formal.\n"
    "  3) Use metrics.compute(<axiom_id>) para obter os números da verdade.\n"
    "  4) Para perguntas com relações entre entidades, use kg.cypher_readonly.\n\n"
    "Ao redigir a resposta final:\n"
    "  - Apresente o resultado de forma clara e profissional para um usuário de negócios.\n"
    "  - Explique brevemente O QUE o resultado significa e POR QUÊ o axioma se aplica.\n"
    "  - Cite o axioma usado (ex.: AX-DEFAULT-90) e o critério que ele define.\n"
    "  - Se houver múltiplas entidades, liste-as explicitamente.\n"
    "  - JAMAIS invente um número; se faltar dado, diga 'não encontrado'."
)


def _registry() -> MCPRegistry:
    # Ponto único: o agregador descobre e roteia todas as tools
    return MCPRegistry({"agg": settings.mcp_gateway_url})


# ---- Tool catalog para o LLM (formato OpenAI tools) -----------------------

async def _tools_catalog(reg: MCPRegistry) -> list[dict]:
    # O agregador já retorna tools prefixadas (metrics__compute, etc.)
    tools = await reg.client("agg").list_tools()
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("inputSchema") or {"type": "object", "properties": {}},
            },
        }
        for t in tools
        if "_error" not in t
    ]


async def _exec_tool(reg: MCPRegistry, name: str, args: dict):
    # name já é prefixado (ex: "metrics__compute") — agrega roteia pelo prefixo
    return await reg.client("agg").call(name, args)


# ---- Pipeline determinístico (MOCK / fallback) ----------------------------

# heurística: termo -> axioma; usado apenas no modo mock ou de fallback
DEFAULT_TERMS = {
    "inadimplente": "AX-DEFAULT-90",
    "inadimplência": "AX-DEFAULT-90",
    "atrasado": "AX-OVERDUE-NOT-DEFAULT",
    "atrasados": "AX-OVERDUE-NOT-DEFAULT",
    "em atraso": "AX-OVERDUE-NOT-DEFAULT",
    "ativo": "AX-ACTIVE-CUSTOMER",
    "ativos": "AX-ACTIVE-CUSTOMER",
    "exposição": "AX-EXPOSURE",
    "carteira": "Metric:PortfolioSize",
    "spread": "Metric:Spread",
    "npl": "AX-NPL-RATIO",
    "ltv": "AX-LTV",
    "não ativos": "AX-INACTIVE-CUSTOMER",
    "inativos": "AX-INACTIVE-CUSTOMER",
    "inativo": "AX-INACTIVE-CUSTOMER",
    "não estão ativos": "AX-INACTIVE-CUSTOMER",
    "contas correntes": "Metric:CheckingAccounts",
    "conta corrente": "Metric:CheckingAccounts",
    "ltv abaixo": "AX-MORTGAGE-LTV-SAFE",
    "ltv menor": "AX-MORTGAGE-LTV-SAFE",
    "ltv inferior": "AX-MORTGAGE-LTV-SAFE",
    "imobiliário": "AX-MORTGAGE-LTV-SAFE",
}

CUSTOMER_RE = re.compile(r"\bC\d{3}\b", re.IGNORECASE)


async def _mock_pipeline(reg: MCPRegistry, question: str) -> AsyncIterator[WorkstripEvent]:
    qlow = question.lower()

    # 1. Disambig
    yield WorkstripEvent("tool_call", "semantic", "disambig__suggest", {"args": {"text": question}})
    sug = await reg.client("agg").call("disambig__suggest", {"text": question})
    yield WorkstripEvent(
        "tool_result", "semantic", f"{len(sug['result'].get('matches', []))} termos detectados",
        {"output": sug["result"], "tool": "disambig__suggest"}, elapsed_ms=sug["elapsed_ms"],
    )

    # 2. resolve_term para cada termo + identificar axioma principal
    main_axiom = None
    matched_terms = sug["result"].get("matches", [])
    for m in matched_terms:
        if m.get("type") == "axiom" and not main_axiom:
            main_axiom = m["resolves_to"]
    if not main_axiom:
        for k, v in DEFAULT_TERMS.items():
            if k in qlow:
                main_axiom = v
                break

    # 3. ontology.get_axiom
    if main_axiom and main_axiom.startswith("AX-"):
        yield WorkstripEvent("tool_call", "semantic", f"ontology__get_axiom", {"args": {"axiom_id": main_axiom}})
        ax = await reg.client("agg").call("ontology__get_axiom", {"axiom_id": main_axiom})
        yield WorkstripEvent("tool_result", "semantic", "axioma carregado",
                             {"output": ax["result"], "tool": "ontology__get_axiom"},
                             elapsed_ms=ax["elapsed_ms"])

    # 4. metrics.compute
    metric_id = main_axiom or "Metric:PortfolioSize"
    customer_filter = None
    cm = CUSTOMER_RE.search(question)
    if cm:
        customer_filter = cm.group().upper()
    yield WorkstripEvent(
        "tool_call", "semantic", "metrics__compute",
        {"args": {"id": metric_id, "filter_customer_id": customer_filter}}
    )
    metric = await reg.client("agg").call(
        "metrics__compute", {"id": metric_id, **({"filter_customer_id": customer_filter} if customer_filter else {})}
    )
    yield WorkstripEvent(
        "tool_result", "semantic", f"{metric['result'].get('count', 0)} linhas",
        {"output": metric["result"], "tool": "metrics__compute"}, elapsed_ms=metric["elapsed_ms"]
    )

    # 5. KG opcional — para perguntas com relação imobiliária/garantia
    if any(t in qlow for t in ["imóvel", "imovel", "imobili", "garantia", "ltv", "secured", "garantido"]):
        cy = (
            "MATCH (k:CreditContract)-[:SECURED_BY]->(g:Collateral) "
            "WHERE k.product='MORTGAGE' AND g.type='REAL_ESTATE' "
            "RETURN k.id AS contract_id, k.principal AS principal, g.appraised_value AS value, "
            "round(toFloat(k.principal)/toFloat(g.appraised_value),4) AS ltv"
        )
        yield WorkstripEvent("tool_call", "semantic", "kg__cypher_readonly", {"args": {"cypher": cy}})
        kg = await reg.client("agg").call("kg__cypher_readonly", {"cypher": cy})
        yield WorkstripEvent("tool_result", "semantic", f"{kg['result'].get('count', 0)} contratos",
                             {"output": kg["result"], "tool": "kg__cypher_readonly"},
                             elapsed_ms=kg["elapsed_ms"])

    # 6. Compor resposta determinística
    rows = metric["result"].get("rows", [])
    answer = _format_answer(question, metric_id, rows, customer_filter)
    yield WorkstripEvent("final", "semantic", "Resposta semântica",
                         {"text": answer, "axiom": main_axiom, "mock": True})


def _format_answer(question: str, metric_id: str, rows: list[dict], customer_filter: str | None) -> str:
    if not rows:
        return f"Aplicando {metric_id}: nenhum registro encontrado."
    if metric_id == "AX-OVERDUE-NOT-DEFAULT":
        ids = sorted({r["customer_id"] for r in rows})
        return f"Aplicando AX-OVERDUE-NOT-DEFAULT (0 < DPD < 90 e não inadimplente), os clientes em atraso mas não inadimplentes são: {', '.join(ids)}."
    if metric_id == "AX-DEFAULT-90":
        ids = sorted({r["customer_id"] for r in rows})
        return f"Aplicando AX-DEFAULT-90 (DPD ≥ 90), os clientes inadimplentes são: {', '.join(ids)}."
    if metric_id == "AX-ACTIVE-CUSTOMER":
        ids = sorted({r["customer_id"] for r in rows})
        return f"Aplicando AX-ACTIVE-CUSTOMER, há {len(ids)} clientes ativos: {', '.join(ids)}."
    if metric_id == "AX-EXPOSURE":
        if customer_filter:
            v = sum(float(r.get("exposure", 0)) for r in rows)
            return f"Aplicando AX-EXPOSURE, a exposição de {customer_filter} é R$ {v:,.2f}."
        total = sum(float(r.get("exposure", 0)) for r in rows)
        return f"Aplicando AX-EXPOSURE, a exposição total é R$ {total:,.2f}."
    if metric_id == "AX-NPL-RATIO":
        r = rows[0]
        return f"Aplicando AX-NPL-RATIO, NPL Ratio = {float(r['npl_ratio']):.4%} (NPL R$ {float(r['npl_exposure']):,.2f} / Carteira R$ {float(r['total_exposure']):,.2f})."
    if metric_id == "Metric:Spread":
        spreads = [float(r["spread"]) for r in rows]
        avg = sum(spreads) / len(spreads)
        return f"Aplicando Metric:Spread (taxa - CDI 10,5%), spread médio = {avg:.2%} sobre {len(spreads)} contratos vivos."
    if metric_id == "Metric:PortfolioSize":
        v = float(rows[0].get("portfolio", 0))
        return f"Aplicando Metric:PortfolioSize, a carteira ativa é R$ {v:,.2f}."
    if metric_id == "AX-LTV":
        return f"Aplicando AX-LTV: {len(rows)} contratos com colateral computado."
    if metric_id == "AX-INACTIVE-CUSTOMER":
        ids = sorted({r["customer_id"] for r in rows})
        if not ids:
            return "Aplicando AX-INACTIVE-CUSTOMER: todos os clientes estão ativos — nenhum inativo encontrado."
        return f"Aplicando AX-INACTIVE-CUSTOMER (complemento de AX-ACTIVE-CUSTOMER), os clientes NÃO ativos são: {', '.join(ids)}."
    if metric_id == "Metric:CheckingAccounts":
        v = rows[0].get("checking_accounts", 0)
        return f"Aplicando Metric:CheckingAccounts, há {v} contas correntes abertas (type=CHECKING e closed_at IS NULL)."
    if metric_id == "AX-MORTGAGE-LTV-SAFE":
        ids = sorted({r["contract_id"] for r in rows})
        if not ids:
            return "Aplicando AX-MORTGAGE-LTV-SAFE: nenhum contrato imobiliário com LTV < 80% encontrado."
        return f"Aplicando AX-MORTGAGE-LTV-SAFE (MORTGAGE + REAL_ESTATE + LTV < 80%), os contratos são: {', '.join(ids)}."
    return f"{metric_id}: {json.dumps(rows[:5], ensure_ascii=False)}"


# ---- Loop com tool-calling real do Azure OpenAI ---------------------------

async def _llm_pipeline(reg: MCPRegistry, question: str) -> AsyncIterator[WorkstripEvent]:
    tools = await _tools_catalog(reg)
    messages = [
        {"role": "system", "content": SYSTEM_SEMANTIC},
        {"role": "user", "content": question},
    ]
    for step in range(12):
        res = await llm.chat(messages, naive=False, tools=tools, tool_choice="auto", temperature=0.0)
        if res["tool_calls"]:
            # Emit thinking AFTER LLM decision — now we know which tools were chosen
            chosen = [tc["name"].replace("__", ".") for tc in res["tool_calls"]]
            yield WorkstripEvent(
                "thinking", "semantic",
                f"Decidiu chamar: {', '.join(chosen)}",
                {"step": step + 1, "tools_chosen": chosen},
            )
            for tc in res["tool_calls"]:
                yield WorkstripEvent("tool_call", "semantic", tc["name"],
                                     {"args": tc["arguments"]})
                exec_res = await _exec_tool(reg, tc["name"], tc["arguments"])
                yield WorkstripEvent(
                    "tool_result", "semantic", "ok" if not exec_res["isError"] else "erro",
                    {"output": exec_res["result"], "tool": tc["name"]},
                    elapsed_ms=exec_res["elapsed_ms"],
                )
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tc["id"], "type": "function",
                        "function": {"name": tc["name"],
                                     "arguments": json.dumps(tc["arguments"])}
                    }]
                })
                messages.append({
                    "role": "tool", "tool_call_id": tc["id"],
                    "content": json.dumps(exec_res["result"], ensure_ascii=False, default=str)
                })
            continue
        # sem tool_calls => resposta final
        yield WorkstripEvent(
            "thinking", "semantic", "Compondo resposta final",
            {"step": step + 1, "tools_chosen": []},
        )
        yield WorkstripEvent("final", "semantic", "Resposta semântica",
                             {"text": res["content"] or "", "mock": False})
        return
    yield WorkstripEvent("error", "semantic", "limite de tool-calls atingido",
                         {"text": "tool loop limit"})


async def run_semantic(question: str) -> AsyncIterator[WorkstripEvent]:
    yield WorkstripEvent("agent_started", "semantic",
                         "Semantic Agent iniciou", {"question": question})
    reg = _registry()
    try:
        if settings.azure_configured:
            async for ev in _llm_pipeline(reg, question):
                yield ev
        else:
            async for ev in _mock_pipeline(reg, question):
                yield ev
    finally:
        for c in reg.clients.values():
            await c.close()
