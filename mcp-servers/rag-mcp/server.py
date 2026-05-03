"""
rag-mcp — busca vetorial para o agente naive.

Tools:
  - rag.search(query, k)        -- embedding + busca vetorial no Qdrant
  - rag.list_collections()      -- coleções disponíveis
"""
from __future__ import annotations
import os
from common.mcp_base import MCPServer

QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant:6333")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "banking_docs")
AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
AZURE_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
AZURE_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
AZURE_EMBED_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")

MOCK_CHUNKS = [
    {"text": "Situação dos Clientes: C002 - Inadimplente (127 dias). C004 - Em atraso (31 dias). Critério: atraso > 30 dias (política comercial).", "score": 0.91},
    {"text": "Inadimplente é aquele que não pagou. Critério comercial interno: atraso superior a 30 dias para acionar cobrança preventiva.", "score": 0.83},
    {"text": "Clientes com produto vigente: C001, C002, C003, C004, C005, C006, C007 — 7 clientes. NPL Ratio (interno): 5,2%. Carteira total: R$ 6.200.000,00. Spread médio: 20,5% a.a.", "score": 0.76},
    {"text": "Exposição C002: R$ 8.500,00 (saldo na originação). Contratos imobiliários: K004 (C004, MORTGAGE, LTV 73,8%).", "score": 0.68},
]

server = MCPServer(name="rag", version="1.0.0")

@server.tool(
    name="search",
    description=(
        "Busca chunks relevantes no índice vetorial (Qdrant / banking_docs) usando "
        "similaridade semântica. Retorna os k trechos mais relevantes para a query."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Pergunta ou texto para buscar"},
            "k": {"type": "integer", "description": "Número de chunks a retornar", "default": 4},
        },
        "required": ["query"],
    },
)
async def search(query: str, k: int = 4):
    if not (AZURE_ENDPOINT and AZURE_KEY):
        return {"chunks": MOCK_CHUNKS[:k], "collection": COLLECTION, "mode": "mock", "total": len(MOCK_CHUNKS[:k])}
    from openai import AzureOpenAI
    from qdrant_client import QdrantClient
    aoai = AzureOpenAI(azure_endpoint=AZURE_ENDPOINT, api_key=AZURE_KEY, api_version=AZURE_API_VERSION)
    emb = aoai.embeddings.create(model=AZURE_EMBED_DEPLOYMENT, input=query).data[0].embedding
    qc = QdrantClient(url=QDRANT_URL)
    try:
        hits = qc.search(collection_name=COLLECTION, query_vector=emb, limit=k)
        return {
            "chunks": [{"text": h.payload.get("text", ""), "score": float(h.score)} for h in hits],
            "collection": COLLECTION,
            "mode": "real",
            "total": len(hits),
        }
    finally:
        qc.close()

@server.tool(
    name="list_collections",
    description="Lista as coleções de vetores disponíveis no Qdrant.",
    input_schema={"type": "object", "properties": {}},
)
async def list_collections():
    from qdrant_client import QdrantClient
    qc = QdrantClient(url=QDRANT_URL)
    try:
        cols = qc.get_collections()
        return {"collections": [c.name for c in cols.collections]}
    finally:
        qc.close()

if __name__ == "__main__":
    server.run()
