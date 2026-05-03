# Quickstart

## 1. Pré-requisitos

- Docker 24+ com docker compose
- 4 GB de RAM livres (Neo4j + Postgres + Qdrant)
- (Opcional) Azure OpenAI com deployment de chat e de embedding

## 2. Subir tudo

```bash
cp .env.example .env
# (opcional) edite .env e preencha AZURE_OPENAI_*

docker compose up -d --build
docker compose run --rm seeder
```

Demora ~2 min na primeira vez (build dos containers + download Neo4j).
Verifique a saúde:

```bash
docker compose ps
curl http://localhost:8000/health
```

Se `mode: "real"`, o LLM real está em uso. Se `mode: "mock"`, a demo usa
respostas determinísticas (perfeito para workshops sem chave).

## 3. Abra o frontend

```
http://localhost:3000
```

- **Início**: visão geral.
- **Curso**: 8 lições. Comece pela 1.
- **Playground**: side-by-side com workstrip clicável.
- **Arquitetura**: diagrama interativo dos containers.

## 4. Teste a primeira pergunta

No Playground, clique em **S01 — Quais clientes estão inadimplentes?**, depois
em **Comparar lado a lado**.

O que esperar:
- O agente naive devolve uma lista com C002 + outros nomes (porque os
  documentos misturam "atrasado" com "inadimplente").
- O agente semântico chama `disambig.resolve_term('inadimplente')`,
  carrega `AX-DEFAULT-90`, executa `metrics.compute('AX-DEFAULT-90')` e
  responde apenas **C002**, citando o axioma.

O painel de eval na parte de baixo mostra match/score em tempo real.

## 5. Inspecione o backend

```bash
# Catálogo MCP:
curl -s http://localhost:8000/api/mcp-catalog | jq

# Ontologia:
curl -s http://localhost:8000/api/ontology | jq

# Neo4j Browser (dev):
open http://localhost:7474   # user neo4j / pass do .env

# Postgres:
docker compose exec postgres psql -U bank -d bankdb -c "SELECT * FROM v_npl_ratio;"
```

## 6. Modo MOCK (sem Azure OpenAI)

Não preencha `AZURE_OPENAI_API_KEY` no `.env`. A demo:
- Naive devolve respostas pré-definidas que reproduzem erros típicos.
- Semantic segue o pipeline canônico via heurísticas — chamadas MCP
  reais, ground truth real, eval real.

A diferença qualitativa entre os agentes é totalmente visível.

## 7. Modo REAL (com Azure OpenAI)

No `.env`, preencha:

```env
AZURE_OPENAI_ENDPOINT=https://SEU-RECURSO.openai.azure.com
AZURE_OPENAI_API_KEY=sk-...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

Reinicie:

```bash
docker compose up -d
docker compose run --rm seeder   # re-seed para indexar Qdrant com embeddings reais
```

Agora o agente semântico usa **tool-calling real** do GPT — você verá
no workstrip quais tools o LLM decidiu chamar e em que ordem.

## 8. Reset

```bash
docker compose down -v   # apaga volumes (Neo4j, Postgres, Qdrant)
```

## Troubleshooting

- **Neo4j health falha**: aumente memória do Docker Desktop para 4GB+.
- **Frontend retorna 502**: aguarde o gateway ficar saudável (até 30s
  na primeira partida).
- **Seeder erra Qdrant sem Azure**: esperado. O seeder pula Qdrant em
  modo MOCK.
- **Erro CORS no browser**: verifique se `NEXT_PUBLIC_GATEWAY_URL` no
  `.env` aponta para `http://localhost:8000`.
