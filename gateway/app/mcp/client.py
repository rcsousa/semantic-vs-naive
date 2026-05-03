"""
Cliente MCP HTTP minimalista. Em produção, use o SDK oficial.

Esta classe abstrai chamadas síncronas/assíncronas para um servidor MCP
implementado pelo nosso `common.mcp_base.MCPServer`. Contrato JSON-RPC 2.0.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx


class MCPClient:
    def __init__(self, base_url: str, name: str, timeout: float = 15.0):
        self.base_url = base_url.rstrip("/")
        self.name = name
        self.timeout = timeout
        self._tools: list[dict] | None = None
        self._client = httpx.AsyncClient(timeout=timeout)

    async def initialize(self) -> dict:
        r = await self._client.post(f"{self.base_url}/mcp", json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}
        })
        r.raise_for_status()
        return r.json().get("result", {})

    async def list_tools(self) -> list[dict]:
        if self._tools is not None:
            return self._tools
        r = await self._client.post(f"{self.base_url}/mcp", json={
            "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}
        })
        r.raise_for_status()
        self._tools = r.json()["result"]["tools"]
        return self._tools

    async def call(self, tool: str, arguments: dict | None = None) -> dict:
        t0 = time.perf_counter()
        r = await self._client.post(f"{self.base_url}/mcp", json={
            "jsonrpc": "2.0", "id": int(time.time() * 1000),
            "method": "tools/call",
            "params": {"name": tool, "arguments": arguments or {}}
        })
        r.raise_for_status()
        data = r.json().get("result", {})
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        # Extrai o conteúdo do envelope MCP em algo amigável.
        content = data.get("content") or []
        if content and content[0].get("type") == "json":
            payload = content[0]["json"]
        elif content and content[0].get("type") == "text":
            payload = {"text": content[0]["text"]}
        else:
            payload = data
        return {
            "tool": f"{self.name}.{tool}",
            "arguments": arguments or {},
            "result": payload,
            "isError": data.get("isError", False),
            "elapsed_ms": elapsed_ms,
            "metadata": data.get("metadata", {}),
        }

    async def close(self):
        await self._client.aclose()


class MCPRegistry:
    """Registro de todos os MCP servers usados pelo gateway."""

    def __init__(self, urls: dict[str, str]):
        self.clients: dict[str, MCPClient] = {
            name: MCPClient(url, name) for name, url in urls.items()
        }

    async def list_all_tools(self) -> dict[str, list[dict]]:
        out: dict[str, list[dict]] = {}
        for name, c in self.clients.items():
            try:
                out[name] = await c.list_tools()
            except Exception as e:  # noqa: BLE001
                out[name] = [{"_error": str(e)}]
        return out

    def client(self, name: str) -> MCPClient:
        return self.clients[name]
