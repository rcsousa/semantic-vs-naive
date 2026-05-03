"""Configuração central do gateway."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    azure_endpoint: str = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
    azure_key: str = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
    azure_deployment: str = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
    azure_api_version: str = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
    azure_embed_deployment: str = os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")

    # Ponto único de entrada MCP — o agregador roteia para os backends
    mcp_gateway_url: str = os.environ.get("MCP_GATEWAY_URL", "http://mcp-gateway:8080")
    qdrant_url: str = os.environ.get("QDRANT_URL", "http://qdrant:6333")

    @property
    def azure_configured(self) -> bool:
        return bool(self.azure_endpoint and self.azure_key)


settings = Settings()
