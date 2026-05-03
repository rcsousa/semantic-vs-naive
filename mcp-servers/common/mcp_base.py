"""
Base mínima de um servidor MCP (Model Context Protocol).

Esta demo implementa o transporte HTTP-JSON-RPC do MCP de forma compacta
e didática para evitar dependências pesadas. Cada server expõe:

  POST /mcp        — JSON-RPC 2.0 (initialize, tools/list, tools/call)
  GET  /mcp/sse    — Server-Sent Events stream (notifications)
  GET  /tools      — REST helper (lista das tools, formato amigável)
  POST /tools/{name} — REST helper (chama uma tool diretamente)
  GET  /health     — healthcheck

A intenção é mostrar o CONTRATO do MCP de forma legível, não substituir o
SDK oficial. Em produção use `mcp` (modelcontextprotocol/python-sdk).
"""
from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("mcp")


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[..., Awaitable[Any]]


class MCPServer:
    """Servidor MCP minimalista com transporte HTTP."""

    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.tools: dict[str, Tool] = {}
        self.app = FastAPI(title=f"MCP — {name}")
        self._setup_routes()

    def tool(self, name: str, description: str, input_schema: dict):
        """Decorator para registrar uma tool."""
        def deco(fn):
            self.tools[name] = Tool(name=name, description=description,
                                    input_schema=input_schema, handler=fn)
            return fn
        return deco

    def _list_tools(self) -> list[dict]:
        return [
            {"name": t.name, "description": t.description, "inputSchema": t.input_schema}
            for t in self.tools.values()
        ]

    async def _call_tool(self, name: str, arguments: dict) -> dict:
        if name not in self.tools:
            return {"isError": True, "content": [{"type": "text", "text": f"unknown tool: {name}"}]}
        tool = self.tools[name]
        t0 = time.perf_counter()
        try:
            result = tool.handler(**(arguments or {}))
            if inspect.isawaitable(result):
                result = await result
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            log.info(f"[{self.name}] tool={name} ok elapsed_ms={elapsed_ms}")
            return {
                "isError": False,
                "content": [{"type": "json", "json": result}],
                "metadata": {"elapsed_ms": elapsed_ms, "server": self.name}
            }
        except Exception as e:  # noqa: BLE001
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            log.exception(f"[{self.name}] tool={name} error")
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}],
                "metadata": {"elapsed_ms": elapsed_ms, "server": self.name}
            }

    def _setup_routes(self):
        app = self.app

        @app.get("/health")
        async def health():
            return {"ok": True, "name": self.name, "version": self.version,
                    "tools": list(self.tools.keys())}

        @app.get("/tools")
        async def tools():
            return {"tools": self._list_tools()}

        @app.post("/tools/{tool_name}")
        async def call_tool_rest(tool_name: str, request: Request):
            try:
                args = await request.json()
            except Exception:
                args = {}
            return await self._call_tool(tool_name, args or {})

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
                    "serverInfo": {"name": self.name, "version": self.version}
                }
            elif method == "tools/list":
                result = {"tools": self._list_tools()}
            elif method == "tools/call":
                result = await self._call_tool(params.get("name"), params.get("arguments") or {})
            else:
                return JSONResponse({"jsonrpc": "2.0", "id": rpc_id,
                                     "error": {"code": -32601, "message": "method not found"}},
                                    status_code=400)
            return {"jsonrpc": "2.0", "id": rpc_id, "result": result}

        @app.get("/mcp/sse")
        async def mcp_sse():
            async def gen():
                # ping inicial e depois manter conexão viva
                yield f"event: hello\ndata: {json.dumps({'server': self.name})}\n\n"
                while True:
                    await asyncio.sleep(15)
                    yield f": keep-alive\n\n"
            return StreamingResponse(gen(), media_type="text/event-stream")

    def run(self, host: str = "0.0.0.0", port: int = 8080):
        import uvicorn
        uvicorn.run(self.app, host=host, port=port, log_level="info")
