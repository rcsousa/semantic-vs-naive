"""
Seeder one-shot:
  - Postgres base: seedado automaticamente via /docker-entrypoint-initdb.d
    (01_schema.sql + 02_seed.sql) na primeira inicialização.
  - Postgres KV: seed do Módulo 2 (03_seed_kv.sql) executado sempre aqui,
    idempotente via ON CONFLICT DO NOTHING.
  - Neo4j: carrega cypher seed (idempotente por MERGE).
  - Qdrant: recria coleção banking_docs com embeddings Azure OpenAI.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct


NEO4J_URI = os.environ["NEO4J_URI"]
NEO4J_USER = os.environ["NEO4J_USER"]
NEO4J_PASSWORD = os.environ["NEO4J_PASSWORD"]
QDRANT_URL = os.environ["QDRANT_URL"]
POSTGRES_DSN = os.environ.get("POSTGRES_DSN", "")

CYPHER_PATH = Path("/data/seed/neo4j_seed.cypher")
KV_SQL_PATH = Path("/data/seed/postgres/03_seed_kv.sql")
DOCS_DIR = Path("/data/docs")


def seed_postgres_kv():
    """Aplica o seed da carteira volátil (KV) — idempotente."""
    if not POSTGRES_DSN:
        print("[seeder] POSTGRES_DSN não configurado — pulando KV seed.")
        return
    if not KV_SQL_PATH.exists():
        print(f"[seeder] {KV_SQL_PATH} não encontrado — pulando KV seed.")
        return

    import psycopg
    sql = KV_SQL_PATH.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
    print(f"[seeder] Aplicando KV seed ({len(statements)} statements)…")
    with psycopg.connect(POSTGRES_DSN) as conn:
        with conn.cursor() as cur:
            for stmt in statements:
                cur.execute(stmt)
        conn.commit()
    print("[seeder] KV seed ok — C009 + KV001-KV006 inseridos (ou já existiam).")


def seed_neo4j():
    print("[seeder] Carregando Neo4j…")
    cypher = CYPHER_PATH.read_text(encoding="utf-8")
    statements = [s.strip() for s in cypher.split(";") if s.strip()]
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session() as s:
        for stmt in statements:
            try:
                s.run(stmt)
            except Exception as e:  # noqa: BLE001
                print(f"  warn: {e!r}\n   stmt={stmt[:80]}…")
    print("[seeder] Neo4j ok.")


def seed_qdrant():
    print("[seeder] Carregando Qdrant…")
    docs = []
    for p in DOCS_DIR.glob("*.md"):
        text = p.read_text(encoding="utf-8")
        chunks = [c.strip() for c in text.split("\n\n") if c.strip()]
        docs.extend((str(p.name), c) for c in chunks)
    print(f"  {len(docs)} chunks")

    qc = QdrantClient(url=QDRANT_URL)
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
    api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
    embed_dep = os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
    api_ver = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    if not (endpoint and api_key):
        print("[seeder] Sem Azure OpenAI: pulando Qdrant (modo MOCK só usa fallback).")
        return

    from openai import AzureOpenAI
    aoai = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version=api_ver)
    try:
        probe = aoai.embeddings.create(model=embed_dep, input=["probe"]).data[0].embedding
    except Exception as e:
        print(f"[seeder] Azure OpenAI FAILED (embeddings inacessível): {e}", file=sys.stderr)
        print("[seeder] Qdrant pulado — suba com credenciais válidas para indexar vetores.")
        return
    dim = len(probe)
    if qc.collection_exists("banking_docs"):
        qc.delete_collection("banking_docs")
    qc.create_collection(
        collection_name="banking_docs",
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )
    points = []
    BATCH = 16
    for i in range(0, len(docs), BATCH):
        batch = docs[i:i+BATCH]
        embs = aoai.embeddings.create(model=embed_dep, input=[t for _, t in batch]).data
        for (src, txt), e in zip(batch, embs):
            points.append(PointStruct(id=str(uuid.uuid4()), vector=e.embedding,
                                       payload={"text": txt, "source": src}))
    qc.upsert(collection_name="banking_docs", points=points)
    print(f"[seeder] Qdrant ok ({len(points)} points).")


if __name__ == "__main__":
    try:
        seed_postgres_kv()
    except Exception as e:  # noqa: BLE001
        print(f"[seeder] KV seed FAILED: {e}", file=sys.stderr)
    try:
        seed_neo4j()
    except Exception as e:  # noqa: BLE001
        print(f"[seeder] Neo4j FAILED: {e}", file=sys.stderr)
    try:
        seed_qdrant()
    except Exception as e:  # noqa: BLE001
        print(f"[seeder] Qdrant FAILED: {e}", file=sys.stderr)
    print("[seeder] done.")
