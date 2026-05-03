"""
mcp-gateway — gateway MCP que agrega todos os servidores MCP.

Expõe uma única interface MCP (tools/list + tools/call) que:
  1. Descobre tools de todos os backends registrados
  2. Prefixa com server__tool (ex: metrics__compute, kg__cypher_readonly)
  3. Roteia tools/call para o backend correto pelo prefixo

Agentes só precisam conhecer este endpoint. Novos MCPs são registrados
aqui sem reconfigurar os agentes.
"""
from __future__ import annotations

import logging
import os
import time

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("mcp-gateway")

BACKENDS: dict[str, str] = {
    "disambig": os.environ.get("MCP_DISAMBIG_URL", "http://mcp-disambiguation:8080"),
    "ontology": os.environ.get("MCP_ONTOLOGY_URL", "http://mcp-ontology:8080"),
    "metrics":  os.environ.get("MCP_METRICS_URL",  "http://mcp-metrics:8080"),
    "kg":       os.environ.get("MCP_KG_URL",        "http://mcp-kg:8080"),
    "rag":      os.environ.get("MCP_RAG_URL",       "http://mcp-rag:8080"),
    "eval":     os.environ.get("MCP_EVAL_URL",      "http://mcp-eval:8080"),
}

app = FastAPI(title="MCP Aggregator", version="1.0.0")


async def _list_tools(client: httpx.AsyncClient, server: str, url: str) -> list[dict]:
    """Busca tools de um backend e prefixa com server__."""
    try:
        r = await client.post(
            f"{url}/mcp",
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
            timeout=5.0,
        )
        r.raise_for_status()
        tools = r.json()["result"]["tools"]
        return [
            {
                **t,
                "name": f"{server}__{t['name']}",
                "description": f"[{server}] {t.get('description', '')}",
            }
            for t in tools
        ]
    except Exception as exc:
        log.warning("backend %s unavailable: %s", server, exc)
        return []


async def _call_tool(
    client: httpx.AsyncClient, server: str, tool: str, arguments: dict
) -> dict:
    """Roteia tools/call para o backend correto."""
    url = BACKENDS[server]
    t0 = time.perf_counter()
    r = await client.post(
        f"{url}/mcp",
        json={
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": "tools/call",
            "params": {"name": tool, "arguments": arguments},
        },
        timeout=30.0,
    )
    r.raise_for_status()
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    result = r.json().get("result", {})
    result.setdefault("metadata", {})
    result["metadata"]["elapsed_ms"] = elapsed_ms
    result["metadata"]["routed_to"] = server
    return result


@app.get("/health")
async def health():
    return {
        "ok": True,
        "name": "mcp-gateway",
        "version": "1.0.0",
        "backends": list(BACKENDS.keys()),
    }


@app.get("/tools")
async def tools_rest():
    async with httpx.AsyncClient() as client:
        all_tools: list[dict] = []
        for server, url in BACKENDS.items():
            all_tools.extend(await _list_tools(client, server, url))
    return {"tools": all_tools}


@app.post("/mcp")
async def mcp_jsonrpc(request: Request):
    payload = await request.json()
    method = payload.get("method")
    params = payload.get("params") or {}
    rpc_id = payload.get("id")

    if method == "initialize":
        result = {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "mcp-gateway", "version": "1.0.0"},
        }

    elif method == "tools/list":
        async with httpx.AsyncClient() as client:
            all_tools: list[dict] = []
            for server, url in BACKENDS.items():
                all_tools.extend(await _list_tools(client, server, url))
        result = {"tools": all_tools}

    elif method == "tools/call":
        name: str = params.get("name", "")
        arguments: dict = params.get("arguments") or {}

        if "__" not in name:
            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32602,
                        "message": f"Tool name must use prefix: server__tool. Got: '{name}'",
                    },
                }
            )

        server, tool = name.split("__", 1)
        if server not in BACKENDS:
            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32602,
                        "message": f"Unknown server '{server}'. Available: {list(BACKENDS.keys())}",
                    },
                }
            )

        async with httpx.AsyncClient() as client:
            try:
                result = await _call_tool(client, server, tool, arguments)
            except Exception as exc:
                log.exception("routing error for %s", name)
                result = {
                    "isError": True,
                    "content": [{"type": "text", "text": f"{type(exc).__name__}: {exc}"}],
                }

    else:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "id": rpc_id,
                "error": {"code": -32601, "message": f"method not found: {method}"},
            }
        )

    return {"jsonrpc": "2.0", "id": rpc_id, "result": result}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
