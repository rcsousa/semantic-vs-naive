# Decisões de arquitetura

## 1. Por que MCP como protocolo único?

O Model Context Protocol é um padrão JSON-RPC sobre HTTP/SSE para expor
tools a LLMs. Adotá-lo como **único** transporte agente↔backend traz:

1. **Descobribilidade.** Cada serviço publica `tools/list` com input
   schemas. O agente decide o que chamar com base em metadados, não em
   prompt engineering.
2. **Versionamento.** O contrato é o input schema. Mudou? Bumpa a versão
   do server. Clientes detectam.
3. **Composição.** Um agente é só um servidor MCP. Outro agente o
   consome do mesmo jeito que consome `metrics__compute`.

## 2. Por que o padrão MCP Gateway?

Em vez de os agentes conhecerem os 6 endereços dos MCPs individualmente,
um **MCP Gateway** centraliza a descoberta:

```
Agent → mcp-gateway:8080
           ↓ tools/list (agrega todos)
           ↓ tools/call (roteia pelo prefixo)
    disambig  ontology  metrics  kg  rag  eval
```

Benefícios:
- Agentes configuram **1 URL** em vez de 6.
- Adicionar um novo MCP = registrar no gateway, zero mudança nos agentes.
- Ponto central para logging e observabilidade futura.
- O prefixo `server__tool` torna o roteamento transparente:
  `metrics__compute` → `mcp-metrics`, `kg__cypher_readonly` → `mcp-kg`.

## 3. Por que separar `metrics-mcp` de `kg-mcp`?

Porque a verdade de uma métrica regulatória é **SQL** (auditável em PR),
e a verdade de uma resposta relacional é **Cypher**. Forçar tudo em uma
camada perde nuance.

- `metrics-mcp`: contrato fechado. Você só pode chamar métricas
  publicadas (10 métricas/axiomas). O LLM **não escreve SQL**.
- `kg-mcp`: contrato aberto, mas read-only. O LLM pode escrever Cypher
  para perguntas relacionais (LTV, garantias). Há validação que bloqueia
  qualquer statement de escrita.

## 4. Por que `rag-mcp` em vez de Qdrant direto no gateway?

Isolamento de responsabilidade e rastreabilidade:

- O **gateway** nunca acessa backends diretamente — só MCP servers.
- `mcp-rag` encapsula: embedding (Azure OpenAI) + busca vetorial (Qdrant).
- Isso faz o agente naive aparecer no sequence diagram com setas reais
  (`rag__search → Qdrant`) em vez de uma chamada opaca.
- Troca de modelo de embedding = troca em `mcp-rag`, zero mudança nos
  agentes.

## 5. Por que três redes internas (`edge`, `agents`, `data`)?

Defesa em profundidade:

| Rede | Participantes | Acesso externo |
| --- | --- | --- |
| `edge` | frontend, gateway | host (portas 3000, 8000) |
| `agents` | gateway, mcp-gateway, MCPs | nenhum (internal) |
| `data` | MCPs, Neo4j, Postgres, Qdrant | nenhum (internal) |

Se um MCP server for comprometido, ele não acessa o frontend nem a
internet. O mcp-gateway também está em `agents` (internal), não em `edge`.

O seeder e o mcp-rag têm também `edge` para chamar Azure OpenAI
(endpoint externo).

## 6. Por que Postgres + Neo4j + Qdrant?

- **Postgres** é a fonte da verdade *transacional*. Views materializam
  axiomas com SQL puro (revisável em PR, sem LLM no caminho).
- **Neo4j** brilha em traversals (garantias, redes de relacionamento).
  A relação `SECURED_BY` entre contratos e colaterais é um exemplo direto.
- **Qdrant** participa **só do agente naive** (via mcp-rag), para mostrar
  empiricamente onde RAG vetorial puro falha. O agente semântico nunca
  consulta Qdrant.

## 7. Por que dois corpora no RAG ingênuo?

O agente naive indexa dois documentos propositalmente defeituosos:

- `glossary.md`: definições com múltiplas convenções conflitantes
  ("cliente ativo" tem três sentidos diferentes).
- `carteira_status.md`: relatório interno com **critério de 30 dias** para
  inadimplência (comercial), enquanto o regulatório é 90 dias.

O resultado: o naive dá respostas confiantes e plausíveis, mas
sistematicamente erradas para as perguntas regulatórias. Isso cria o
contraste didático sem que o naive seja trivialmente ruim.

## 8. Avaliação RAGAS-style

O `mcp-eval` compara cada resposta de agente contra ground truth
determinístico (SQL canônico). Quatro dimensões:

| Dimensão | Como é calculada |
| --- | --- |
| **Correto** | Valor extraído por regex vs. SQL canônico (F1 para sets, tolerância para scalars) |
| **Fundamentado** | Presença de `AX-...` ou `Metric:...` no texto |
| **Completo** | Recall de entidades esperadas ou presença de número extraível |
| **Coerente** | Comprimento e estrutura da resposta (proxy de qualidade) |

Score composto: `0.4×correto + 0.25×fundamentado + 0.2×completo + 0.15×coerente`.

O ground truth é determinístico (SQL), não depende de LLM para avaliar.
Isto permite rodar avaliação em CI sem custo de API.

## 9. Modo MOCK

Quando `AZURE_OPENAI_*` não está configurado:

- **Naive**: `mcp-rag` retorna chunks fixos (que induzem os erros reais).
- **Semantic**: orquestrador segue o pipeline canônico com heurísticas de
  desambiguação. Resultado é **idêntico** ao modo real para os cenários
  cobertos pelos axiomas.

Permite demos offline, workshops e CI.

## 10. Quando NÃO usar este padrão?

- Domínio com pouca ambiguidade terminológica.
- Volume de perguntas trivial (chatbot simples).
- Custo de modelar ontologia > custo de erro aceitável.

Para domínios com **regulação, finanças, saúde, jurídico** — onde errar
custa muito mais que modelar — este padrão paga a si mesmo rapidamente.

## 11. Próximos passos (fora do escopo da demo)

- Versionamento de ontologia com diff semântico.
- Auth nas chamadas MCP (a demo confia na rede interna).
- Cache de respostas determinísticas.
- Multi-tenant (a demo assume um único banco).
- OpenTelemetry para rastreabilidade distribuída.
- Benchmark automatizado: `eval.score` em todos os 12 cenários × N runs.
