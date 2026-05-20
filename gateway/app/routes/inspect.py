"""Endpoints de introspecção: ontologia, axiomas, scenarios, MCP catalog."""
from __future__ import annotations

import asyncio
from fastapi import APIRouter

from app.mcp.client import MCPRegistry
from app.settings import settings

router = APIRouter(prefix="/api", tags=["inspect"])


def _agg() -> MCPRegistry:
    return MCPRegistry({"agg": settings.mcp_gateway_url})


@router.get("/ontology")
async def ontology():
    reg = _agg()
    try:
        d = await reg.client("agg").call("ontology__describe", {})
        return d["result"]
    finally:
        for c in reg.clients.values():
            await c.close()


@router.get("/axioms")
async def axioms():
    reg = _agg()
    try:
        d = await reg.client("agg").call("ontology__list_axioms", {})
        return d["result"]
    finally:
        for c in reg.clients.values():
            await c.close()


@router.get("/scenarios")
async def scenarios():
    reg = _agg()
    try:
        d = await reg.client("agg").call("eval__list_scenarios", {})
        return d["result"]
    finally:
        for c in reg.clients.values():
            await c.close()


@router.get("/mcp-catalog")
async def mcp_catalog():
    """Lista todas as tools MCP via agregador — já vêm com prefixo server__tool."""
    reg = _agg()
    try:
        tools = await reg.client("agg").list_tools()
        return {"mcp-gateway": tools}
    finally:
        for c in reg.clients.values():
            await c.close()


@router.get("/synonyms")
async def synonyms():
    reg = _agg()
    try:
        d = await reg.client("agg").call("disambig__list_terms", {})
        return d["result"]
    finally:
        for c in reg.clients.values():
            await c.close()


@router.get("/kg-graph")
async def kg_graph():
    """Grafo completo: instâncias Neo4j + axiomas + métricas como nós."""
    reg = _agg()
    try:
        nodes_r, links_r, axioms_r, onto_r = await asyncio.gather(
            reg.client("agg").call("kg__cypher_readonly", {
                "cypher": (
                    "MATCH (n) WHERE n.id IS NOT NULL "
                    "RETURN labels(n)[0] AS nodeType, n.id AS id LIMIT 300"
                )
            }),
            reg.client("agg").call("kg__cypher_readonly", {
                "cypher": (
                    "MATCH (a)-[r]->(b) "
                    "WHERE a.id IS NOT NULL AND b.id IS NOT NULL "
                    "RETURN a.id AS source, b.id AS target, type(r) AS linkType LIMIT 500"
                )
            }),
            reg.client("agg").call("ontology__list_axioms", {}),
            reg.client("agg").call("ontology__describe", {}),
        )

        nodes: list[dict] = []
        links: list[dict] = []
        node_ids: set[str] = set()

        def add_node(n: dict) -> None:
            if n["id"] not in node_ids:
                nodes.append(n)
                node_ids.add(n["id"])

        # Entity-type class nodes (hubs visuais para axiomas e instâncias)
        for cls in ["Customer", "Account", "CreditContract", "Payment", "Collateral"]:
            add_node({"id": f"class:{cls}", "nodeType": "EntityClass", "label": cls})

        # Instâncias do KG (Neo4j) + typeof edges para o hub da classe
        for row in nodes_r["result"].get("rows", []):
            nt  = row.get("nodeType") or ""
            nid = row.get("id") or ""
            if not nid:
                continue
            add_node({"id": nid, "nodeType": nt, "label": nid})
            class_id = f"class:{nt}"
            if class_id in node_ids:
                links.append({"source": nid, "target": class_id, "linkType": "typeof"})

        # Relacionamentos estruturais do KG (HOLDS, OWNS, HAS_PAYMENT, SECURED_BY)
        for row in links_r["result"].get("rows", []):
            src = row.get("source")
            tgt = row.get("target")
            lt  = row.get("linkType", "RELATED")
            if src and tgt:
                links.append({"source": src, "target": tgt, "linkType": lt})

        # Axiomas + governs edges para o hub da classe de escopo
        for ax in axioms_r["result"].get("axioms", []):
            ax_id = ax.get("id") or ""
            scope = ax.get("scope", "Customer")
            if not ax_id:
                continue
            add_node({
                "id": ax_id,
                "nodeType": "Axiom",
                "label": ax.get("name", ax_id),
                "scope": scope,
                "rule_pt": ax.get("rule_pt", ""),
            })
            class_id = f"class:{scope}"
            if class_id in node_ids:
                links.append({"source": ax_id, "target": class_id, "linkType": "governs"})

        # Métricas + measures edges para o hub Customer (métricas são de portfolio/cliente)
        # ontology__describe retorna "metrics" como lista de nomes ou dict — trata ambos
        raw_metrics = onto_r["result"].get("metrics", [])
        metric_items = (
            raw_metrics.items() if isinstance(raw_metrics, dict)
            else ((k, {}) for k in raw_metrics)
        )
        for metric_key, metric_data in metric_items:
            m_id = f"Metric:{metric_key}"
            label = metric_data.get("label_pt", metric_key) if isinstance(metric_data, dict) else metric_key
            add_node({"id": m_id, "nodeType": "Metric", "label": label})
            links.append({"source": m_id, "target": "class:Customer", "linkType": "measures"})

        return {"nodes": nodes, "links": links}

    finally:
        for c in reg.clients.values():
            await c.close()
