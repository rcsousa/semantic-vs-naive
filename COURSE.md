# Curso passo a passo — Agentes Semânticos com Azure OpenAI + MCP

Sequência das 8 lições renderizadas em `/lessons/[id]` no frontend. Este
arquivo serve como índice em texto para quem quer ler offline.

| # | Lição | Conceito-chave | Exercício |
| --- | --- | --- | --- |
| 1 | Por que ontologia explícita | Contrato semântico vs RAG ingênuo | "Quantos clientes ativos temos?" (S03) |
| 2 | Desambiguação de termos | atrasado ≠ inadimplente | "C004 está inadimplente?" (S09) |
| 3 | Métricas determinísticas | LLM lê, não calcula | "Qual o NPL Ratio?" (S06) |
| 4 | Axiomas como guarda-chuva | Regras publicadas, citáveis | "Quem NÃO está ativo?" (S04) |
| 5 | MCP como contrato | tools/list + tools/call padroniza tudo | Inspecione `/api/mcp-catalog` |
| 6 | Agent-as-tool | Composição em vez de acoplamento | Use `eval.score` em resposta livre |
| 7 | Evals em tempo real | Ground truth determinístico | "Spread médio?" (S07) |
| 8 | Hands-on | Quebre a demo de 5 formas | (5 experimentos guiados) |

## Referências da arquitetura aplicada

- **MCP** — Model Context Protocol (modelcontextprotocol.io)
- **Basel III / Bacen Resolução 4.557** — definição de default ≥ 90 DPD
- **Knowledge Graphs em finanças** — práticas amplamente documentadas em
  bancos europeus desde 2018 (BBVA, ING, Goldman Sachs).
