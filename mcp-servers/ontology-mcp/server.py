"""
ontology-mcp — serve a ontologia bancária e seus axiomas como contrato MCP.

Tools:
  - ontology.describe()                     -- ontologia completa
  - ontology.get_class(name)                -- detalhes de uma classe
  - ontology.list_axioms(scope=None)        -- axiomas, opcionalmente por escopo
  - ontology.get_axiom(axiom_id)            -- axioma específico (com query)
  - ontology.validate_against_axiom(...)    -- valida um valor contra um axioma
"""
from __future__ import annotations

import json
import os

from common.mcp_base import MCPServer

ONTOLOGY_PATH = os.environ.get("ONTOLOGY_PATH", "/data/ontology/banking.json")

with open(ONTOLOGY_PATH, "r", encoding="utf-8") as f:
    ONTO = json.load(f)

server = MCPServer(name="ontology", version="1.0.0")


@server.tool(
    name="describe",
    description="Retorna a ontologia completa do domínio (classes, relações, axiomas, métricas).",
    input_schema={"type": "object", "properties": {}},
)
async def describe():
    return {
        "name": ONTO["name"],
        "version": ONTO["version"],
        "classes": list(ONTO["classes"].keys()),
        "relations": list(ONTO["relations"].keys()),
        "axioms": [a["id"] for a in ONTO["axioms"]],
        "metrics": list(ONTO.get("metrics", {}).keys()),
    }


@server.tool(
    name="get_class",
    description="Detalha uma classe da ontologia, com atributos e label PT-BR.",
    input_schema={
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"]
    }
)
async def get_class(name: str):
    cls = ONTO["classes"].get(name)
    if not cls:
        # tenta case-insensitive
        for k, v in ONTO["classes"].items():
            if k.lower() == name.lower():
                cls = v
                name = k
                break
    if not cls:
        raise ValueError(f"Classe '{name}' não existe na ontologia.")
    return {"name": name, **cls}


@server.tool(
    name="list_axioms",
    description="Lista axiomas. Opcionalmente filtra por scope (Customer, Portfolio, CreditContract).",
    input_schema={
        "type": "object",
        "properties": {"scope": {"type": "string"}}
    }
)
async def list_axioms(scope: str | None = None):
    axioms = ONTO["axioms"]
    if scope:
        axioms = [a for a in axioms if a.get("scope", "").lower() == scope.lower()]
    return {"axioms": [{"id": a["id"], "name": a["name"], "scope": a.get("scope"), "rule_pt": a["rule_pt"]} for a in axioms]}


@server.tool(
    name="get_axiom",
    description="Retorna um axioma completo, incluindo a regra formal e a query determinística canônica.",
    input_schema={
        "type": "object",
        "properties": {"axiom_id": {"type": "string"}},
        "required": ["axiom_id"]
    }
)
async def get_axiom(axiom_id: str):
    for a in ONTO["axioms"]:
        if a["id"].lower() == axiom_id.lower():
            return a
    raise ValueError(f"Axioma '{axiom_id}' não encontrado.")


@server.tool(
    name="validate_against_axiom",
    description=(
        "Valida uma afirmação textual contra um axioma. Útil para o agente checar "
        "antes de afirmar 'cliente X é inadimplente'. Retorna se a afirmação respeita "
        "ou viola o axioma — sem ainda consultar dados."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "axiom_id": {"type": "string"},
            "claim": {"type": "string", "description": "Afirmação livre que será comparada com a regra."}
        },
        "required": ["axiom_id", "claim"]
    }
)
async def validate_against_axiom(axiom_id: str, claim: str):
    ax = await get_axiom(axiom_id)
    return {
        "axiom_id": ax["id"],
        "rule_pt": ax["rule_pt"],
        "rule_logic": ax["rule_logic"],
        "deterministic_query": ax.get("deterministic_query"),
        "next_step": (
            "Para responder com certeza, chame metrics-mcp passando este axiom_id. "
            "Não infira a partir do texto; consulte o backend determinístico."
        ),
        "claim_received": claim,
    }


if __name__ == "__main__":
    server.run()
