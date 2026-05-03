"""
disambiguation-mcp — desambigua termos de negócio antes de qualquer query.

Tools:
  - disambig.resolve_term(term)            -- resolve "cliente ativo", "spread", etc.
  - disambig.list_terms()                  -- lista todos os termos conhecidos
  - disambig.suggest(text)                 -- detecta termos ambíguos no texto
"""
from __future__ import annotations

import json
import os
import re

from common.mcp_base import MCPServer

ONTOLOGY_PATH = os.environ.get("ONTOLOGY_PATH", "/data/ontology/banking.json")
with open(ONTOLOGY_PATH, "r", encoding="utf-8") as f:
    ONTO = json.load(f)

SYNS: dict[str, dict] = ONTO.get("synonyms", {})

server = MCPServer(name="disambiguation", version="1.0.0")


def _norm(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


@server.tool(
    name="resolve_term",
    description=(
        "Resolve um termo de negócio (sinônimo, gíria, abreviação) para sua definição "
        "canônica na ontologia (Class, Axiom, Metric ou Attribute). Retorna avisos quando o "
        "termo é ambíguo ou propenso a confusão."
    ),
    input_schema={
        "type": "object",
        "properties": {"term": {"type": "string"}},
        "required": ["term"]
    }
)
async def resolve_term(term: str):
    key = _norm(term)
    hit = SYNS.get(key)
    if not hit:
        # busca parcial
        for k in SYNS:
            if k in key or key in k:
                hit = {**SYNS[k], "matched_via": k, "fuzzy": True}
                break
    if not hit:
        return {"term": term, "resolved": False, "message": "termo não reconhecido pela ontologia"}
    return {"term": term, "resolved": True, **hit}


@server.tool(
    name="list_terms",
    description="Lista todos os termos cobertos pelo dicionário de desambiguação.",
    input_schema={"type": "object", "properties": {}},
)
async def list_terms():
    return {"terms": [{"term": k, "resolves_to": v["resolves_to"], "type": v["type"]} for k, v in SYNS.items()]}


@server.tool(
    name="suggest",
    description="Detecta no texto termos potencialmente ambíguos e propõe a forma canônica.",
    input_schema={
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"]
    }
)
async def suggest(text: str):
    t = _norm(text)
    found = []
    for term, meta in SYNS.items():
        if term in t:
            entry = {"term": term, **meta}
            found.append(entry)
    return {"text": text, "matches": found}


if __name__ == "__main__":
    server.run()
