# Semantic Agents Demo — naive vs ontology-aware

Demonstração open-source, em Docker Compose, de como **agentes LLM ficam mais
precisos** quando o domínio é descrito por uma **ontologia explícita**, com
**axiomas**, **desambiguação de termos**, **knowledge graph** e **métricas
determinísticas**. Toda interação agente↔backend passa por
**MCP (Model Context Protocol)**, com um **MCP Gateway** centralizando a
descoberta de tools.

A demo é **lado a lado**, com **sequence diagram interativo** mostrando o
fluxo de execução de cada agente em tempo real, incluindo roteamento através
do gateway. Avaliação com **RAGAS-style scoring** (correto, fundamentado,
completo, coerente). O domínio é **crédito bancário** — denso em
ambiguidades reais (atraso ≠ inadimplência, "cliente ativo" tem três
sentidos, NPL Ratio exige axiomas Bacen/Basel).

## TL;DR — como rodar

```bash
cp .env.example .env          # opcional: preencha AZURE_OPENAI_*
docker compose up -d --build  # sobe tudo (inclui mcp-gateway)
docker compose run --rm seeder
open http://localhost:3000
```

Sem chave Azure OpenAI a demo entra em **modo MOCK** (respostas
determinísticas). A trilha didática roda 100%. O modo real adiciona
tool-calling real do LLM e variabilidade nas respostas.

## O que está incluso

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Frontend | Next.js 14 + shadcn/ui + Tailwind | UI lado a lado, sequence diagram, curso (12 lições), página de Governança |
| Gateway | FastAPI + openai SDK | Orquestra os 2 agentes em paralelo, expõe SSE; rota `/api/govern` |
| MCP Gateway | FastAPI | Agrega tools de todos os MCPs; agentes configuram 1 URL |
| mcp-disambig | FastAPI | Resolve termos ambíguos contra a ontologia |
| mcp-ontology | FastAPI | Serve axiomas, classes, relações do banking.json |
| mcp-metrics | FastAPI + Postgres | SQL determinístico — fonte da verdade |
| mcp-kg | FastAPI + Neo4j | Cypher read-only — traversals de grafo |
| mcp-rag | FastAPI + Qdrant + Azure OAI | Busca vetorial para o agente naive |
| mcp-eval | FastAPI + Postgres | RAGAS-style scoring vs ground truth |
| **mcp-judge** | **FastAPI + Azure OAI** | **LLM-as-judge ancorado em ontologia** |
| KG | Neo4j 5.20 + APOC | Grafo de cliente/contrato/garantia |
| Determinístico | Postgres 16 + views | AX-DEFAULT-90, AX-NPL-RATIO, AX-EXPOSURE, Metric:SpreadVolatil |
| Vetorial (naive) | Qdrant 1.9.2 | RAG ingênuo sobre glossário + relatório interno |
| LLM | Azure OpenAI (gpt-5.2 default) | Tool-calling no agente semântico e no judge |

### Módulo 2 — Governança em Runtime

Tese: em ambiente regulado, o agente precisa de três coisas: **calcular**, **julgar** e **parar**.
A auditabilidade é o subproduto quando as três funcionam juntas.

- **`/governance`** — nova página com pipeline governado (um único agente semântico)
- **Killswitch** com 3 gatilhos em OR: RAGAS < 0.70 · judge ≠ consistent · variância > 25 p.p.
- **AuditTrail** com hash SHA-256 reprodutível (exclui timestamps/durations)
- **Cenários S13–S15** (categoria `governance`): caminho feliz, recap S07, jewel (variância)

## Arquitetura

```
┌──────────┐  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────┐  ┌──────────┐
│ Browser  │─▶│   Frontend     │─▶│   Gateway    │─▶│    MCP Gateway      │─▶│  MCPs    │
│          │  │ Next.js 14     │  │ FastAPI      │  │ agrega 6 MCPs       │  │ disambig │
│          │  │ shadcn/ui      │  │ 2 agentes    │  │ prefixo server__tool│  │ ontology │
└──────────┘  └────────────────┘  └──────────────┘  └─────────────────────┘  │ metrics  │
                                                                               │ kg       │
                                                                               │ rag      │
                                                                               │ eval     │
                                                                               └────┬─────┘
                                                                                    │
                                                                     ┌──────────────┼────────┐
                                                                     ▼              ▼        ▼
                                                                  Postgres       Neo4j    Qdrant
                                                                  (truth)        (KG)     (RAG)
```

Quatro redes Docker:
- `edge`: frontend ↔ gateway (única exposta ao host)
- `agents` (internal): gateway ↔ MCP Gateway ↔ MCPs
- `data` (internal): MCPs ↔ backends (Postgres, Neo4j, Qdrant)

Healthchecks em todos os serviços, dependências `service_healthy`.

## Fluxo dos dois agentes

### Agente Naive (controle)
1. Chama `mcp-gateway → rag__search` → `mcp-rag` faz embedding + busca Qdrant.
2. Recupera chunks do glossário (com critérios ambíguos propositais).
3. LLM redige resposta profissional baseada nos chunks — plausível mas
   frequentemente errada por usar critérios comerciais, não regulatórios.

### Agente Semântico (proposta)
1. `disambig__suggest` detecta termos com avisos de ambiguidade.
2. `disambig__resolve_term` mapeia para axioma canônico (ex.: AX-DEFAULT-90).
3. `ontology__get_axiom` carrega regra formal e critério de aplicação.
4. `metrics__compute` executa a query SQL no Postgres (ground truth).
5. `kg__cypher_readonly` para perguntas relacionais (LTV, garantias).
6. LLM redige resposta citando o axioma e explicando o critério.

Em modo real: LLM escolhe tools via tool-calling.
Em modo MOCK: pipeline determinístico com heurísticas.

**Toda chamada de tool passa pelo MCP Gateway**, que roteia pelo prefixo
(`metrics__compute` → `mcp-metrics`, `kg__cypher_readonly` → `mcp-kg`, etc.).

## Avaliação RAGAS

`mcp-eval` compara cada resposta contra ground truth determinístico (SQL).
Quatro dimensões:
- **Correto**: o valor extraído bate com a query canônica?
- **Fundamentado**: a resposta cita axioma ou fonte verificável?
- **Completo**: cobre todas as entidades/valores esperados?
- **Coerente**: estrutura e extensão adequadas para uso profissional?

`data/ground-truth/scenarios.json` traz 12 cenários cobertos pelos axiomas.
Quando você seleciona um cenário no playground, o gateway dispara eval para
os **dois agentes** ao término do streaming.

## Domínio: crédito bancário

`data/ontology/banking.json` define 5 classes, 4 relações, 8 axiomas e ~30
sinônimos. Axiomas principais:

| Axioma | Regra |
| --- | --- |
| AX-DEFAULT-90 | cliente em default ⇔ DPD ≥ 90 (Bacen/Basel III) |
| AX-ACTIVE-CUSTOMER | ao menos uma conta aberta OU contrato ACTIVE |
| AX-EXPOSURE | Σ outstanding_principal de contratos ACTIVE/RENEGOTIATED |
| AX-NPL-RATIO | exposição em default / exposição total |
| AX-LTV | principal / valor da garantia |
| AX-OVERDUE-NOT-DEFAULT | 0 < DPD < 90 E não inadimplente |
| AX-INACTIVE-CUSTOMER | complemento de AX-ACTIVE-CUSTOMER |
| AX-MORTGAGE-LTV-SAFE | MORTGAGE + REAL_ESTATE + LTV < 0.8 |

## Estrutura

```
demo-graph/
├── docker-compose.yml
├── .env.example
├── data/
│   ├── ontology/banking.json           # ontologia + axiomas + sinônimos
│   ├── seed/postgres/01_schema.sql     # tabelas + views axiomáticas
│   ├── seed/postgres/02_seed.sql       # dados com casos ambíguos
│   ├── seed/neo4j_seed.cypher          # mesmo dataset no grafo
│   ├── docs/glossary.md                # corpus RAG (com ambiguidades)
│   ├── docs/carteira_status.md         # relatório interno (critérios errados)
│   └── ground-truth/scenarios.json    # 12 cenários de eval
├── mcp-servers/
│   ├── common/mcp_base.py              # mini-implementação MCP HTTP/JSON-RPC
│   ├── gateway-mcp/                    # MCP Gateway — agrega 6 MCPs
│   ├── kg-mcp/                         # Cypher read-only
│   ├── ontology-mcp/                   # axiomas, classes, relações
│   ├── metrics-mcp/                    # SQL determinístico (10 métricas)
│   ├── disambiguation-mcp/             # resolve termos e sinônimos
│   ├── rag-mcp/                        # embedding + busca vetorial
│   └── eval-mcp/                       # RAGAS-style scoring
├── gateway/
│   └── app/
│       ├── agents/naive_agent.py       # RAG via mcp-gateway → rag__search
│       ├── agents/semantic_agent.py    # MCP pipeline via mcp-gateway
│       ├── llm/azure.py                # cliente + fallback MOCK
│       ├── mcp/client.py               # MCPRegistry + MCPClient
│       └── routes/{compare,inspect}.py
├── frontend/
│   └── app/{page,playground,architecture,lessons}/...
└── scripts/seed.py                     # seeder: Neo4j + Qdrant
```

## Atalhos

```bash
docker compose up -d --build            # sobe tudo
docker compose run --rm seeder          # popula Neo4j + Qdrant
docker compose ps                       # status dos containers
docker compose logs -f gateway          # logs do gateway
docker compose build mcp-gateway        # rebuild do MCP Gateway
```

## Onde ler

- `data/ontology/banking.json` — o contrato semântico.
- `data/seed/postgres/01_schema.sql` — axiomas em SQL (views).
- `mcp-servers/metrics-mcp/server.py` — métricas canônicas.
- `mcp-servers/gateway-mcp/server.py` — roteamento de tools.
- `gateway/app/agents/semantic_agent.py` — pipeline MCP.
- Frontend `/lessons/1` em diante — curso (10 lições).

## Licença

MIT.
