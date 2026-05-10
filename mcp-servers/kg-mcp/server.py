"""
kg-mcp — Knowledge Graph MCP server.

Tools:
  - kg.cypher_readonly(cypher, params)   -- executa Cypher SOMENTE leitura
  - kg.describe_schema()                  -- nodes, rels, propriedades
  - kg.neighbors(node_id, depth)          -- expansão local
  - kg.find_path(from_id, to_id)          -- caminho mais curto

Segurança: rejeita statements que contenham CREATE/DELETE/MERGE/SET/DROP/REMOVE/CALL apoc.
"""
from __future__ import annotations

import os
import re

from neo4j import GraphDatabase
from common.mcp_base import MCPServer

NEO4J_URI = os.environ["NEO4J_URI"]
NEO4J_USER = os.environ["NEO4J_USER"]
NEO4J_PASSWORD = os.environ["NEO4J_PASSWORD"]

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

server = MCPServer(name="kg", version="1.0.0")

WRITE_PATTERN = re.compile(
    r"\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP|DETACH|LOAD\s+CSV|FOREACH|CALL\s+apoc\.\w+\.set)\b",
    re.IGNORECASE,
)


def _serialize(records) -> list[dict]:
    out = []
    for r in records:
        d = {}
        for k, v in r.items():
            try:
                d[k] = dict(v) if hasattr(v, "items") else v
            except Exception:
                d[k] = str(v)
        out.append(d)
    return out


@server.tool(
    name="cypher_readonly",
    description="Executa uma query Cypher SOMENTE LEITURA contra o KG. Rejeita statements de escrita.",
    input_schema={
        "type": "object",
        "properties": {
            "cypher": {"type": "string", "description": "Statement Cypher (read-only)."},
            "params": {"type": "object", "description": "Parâmetros nomeados.", "default": {}},
            "limit": {"type": "integer", "default": 100}
        },
        "required": ["cypher"]
    },
)
async def cypher_readonly(cypher: str, params: dict | None = None, limit: int = 100):
    if WRITE_PATTERN.search(cypher):
        raise ValueError("Cypher contém statement de escrita; este endpoint é read-only.")
    if " LIMIT " not in cypher.upper():
        cypher = cypher.rstrip("; ").rstrip() + f"\nLIMIT {int(limit)}"
    with driver.session() as s:
        result = s.run(cypher, params or {})
        rows = _serialize(result)
    return {"rows": rows, "count": len(rows)}


@server.tool(
    name="describe_schema",
    description=(
        "Retorna o schema do KG: tipos de nó com suas propriedades reais (amostradas), "
        "contagem e relacionamentos com origem e destino. "
        "Use isto antes de escrever qualquer Cypher para saber o nome exato das propriedades de cada nó."
    ),
    input_schema={"type": "object", "properties": {}},
)
async def describe_schema():
    with driver.session() as s:
        labels = s.run(
            "CALL db.labels() YIELD label RETURN collect(label) AS labels"
        ).single()["labels"]

        # Propriedades por tipo de nó (sample de 1 nó real — evita lista plana ambígua)
        node_types: dict = {}
        for lbl in labels:
            try:
                rec = s.run(
                    f"MATCH (n:`{lbl}`) RETURN keys(n) AS props LIMIT 1"
                ).single()
                props = sorted(rec["props"]) if rec else []
                count = s.run(
                    f"MATCH (n:`{lbl}`) RETURN count(n) AS c"
                ).single()["c"]
                node_types[lbl] = {"properties": props, "count": count}
            except Exception:
                node_types[lbl] = {"properties": [], "count": 0}

        # Relacionamentos com origem e destino
        rel_info: list[dict] = []
        rels = s.run(
            "CALL db.relationshipTypes() YIELD relationshipType "
            "RETURN collect(relationshipType) AS r"
        ).single()["r"]
        for rel in rels:
            try:
                rec = s.run(
                    f"MATCH (a)-[r:`{rel}`]->(b) "
                    f"RETURN labels(a)[0] AS from_label, labels(b)[0] AS to_label LIMIT 1"
                ).single()
                entry: dict = {"type": rel}
                if rec:
                    entry["from"] = rec["from_label"]
                    entry["to"] = rec["to_label"]
                rel_info.append(entry)
            except Exception:
                rel_info.append({"type": rel})

    return {"node_types": node_types, "relationships": rel_info}


@server.tool(
    name="neighbors",
    description="Vizinhança de um nó identificado por id, até depth saltos.",
    input_schema={
        "type": "object",
        "properties": {
            "node_id": {"type": "string"},
            "depth": {"type": "integer", "default": 1}
        },
        "required": ["node_id"]
    }
)
async def neighbors(node_id: str, depth: int = 1):
    depth = max(1, min(int(depth), 3))
    cypher = (
        "MATCH (n {id:$id})-[r*1.." + str(depth) + "]-(m) "
        "RETURN n, r, m LIMIT 50"
    )
    with driver.session() as s:
        rows = _serialize(s.run(cypher, {"id": node_id}))
    return {"rows": rows, "count": len(rows)}


@server.tool(
    name="find_path",
    description="Caminho mais curto entre dois nós identificados por id.",
    input_schema={
        "type": "object",
        "properties": {"from_id": {"type": "string"}, "to_id": {"type": "string"}},
        "required": ["from_id", "to_id"]
    }
)
async def find_path(from_id: str, to_id: str):
    cypher = (
        "MATCH (a {id:$a}),(b {id:$b}), p=shortestPath((a)-[*..6]-(b)) "
        "RETURN [n IN nodes(p) | n.id] AS nodes, [r IN relationships(p) | type(r)] AS rels"
    )
    with driver.session() as s:
        rec = s.run(cypher, {"a": from_id, "b": to_id}).single()
    return rec.data() if rec else {"nodes": [], "rels": []}


if __name__ == "__main__":
    server.run()
