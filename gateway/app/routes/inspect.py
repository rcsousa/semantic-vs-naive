"""Endpoints de introspecção: ontologia, axiomas, scenarios, MCP catalog."""
from __future__ import annotations

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
