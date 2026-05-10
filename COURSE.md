# Curso passo a passo — Agentes Semânticos com Azure OpenAI + MCP

Sequência das 12 lições renderizadas em `/lessons/[id]` no frontend. Este
arquivo serve como índice em texto para quem quer ler offline.

## Módulo 1 — Semântica Explícita (Lições 1–8)

| # | Lição | Conceito-chave | Exercício |
| --- | --- | --- | --- |
| 1 | Por que ontologia explícita | Contrato semântico vs RAG ingênuo | "Quantos clientes ativos temos?" (S03) |
| 2 | Desambiguação de termos | atrasado ≠ inadimplente | "C004 está inadimplente?" (S09) |
| 3 | Métricas determinísticas | LLM lê, não calcula | "Qual o NPL Ratio?" (S06) |
| 4 | Axiomas como guarda-chuva | Regras publicadas, citáveis | "Quem NÃO está ativo?" (S04) |
| 5 | MCP como contrato | tools/list + tools/call padroniza tudo | Inspecione `/api/mcp-catalog` |
| 6 | Agent-as-tool | Composição em vez de acoplamento | Use `eval.score` em resposta livre |
| 7 | Evals em tempo real | Ground truth determinístico | "Spread médio?" (S07) |
| 8 | Evals como prova de qualidade | RAGAS: correto, fundamentado, completo, coerente | "NPL Ratio?" (S06) |

## Módulo 2 — Governança em Runtime (Lições 9–12)

**Tese:** em ambiente regulado, o agente precisa de três coisas: **calcular**, **julgar** e **parar**.
A auditabilidade é o subproduto quando as três funcionam juntas.

| # | Lição | Conceito-chave | Exercício |
| --- | --- | --- | --- |
| 9 | Calcular não basta | Velocidade vira passivo sem freio | S15 (antecipação) |
| 10 | LLM-as-judge ancorado em ontologia | consistent / inconsistent / insufficient_evidence | S13 (caminho feliz) |
| 11 | Killswitch — o freio do sistema | 3 gatilhos em OR: RAGAS + judge + variância | S15 (jewel) |
| 12 | Trail auditável como subproduto | Hash SHA-256 reprodutível sem timestamps | S13 × 2 (hash idêntico) |

### Novos componentes do Módulo 2

| Componente | Responsabilidade |
| --- | --- |
| `mcp-judge` | MCP server: `judge.evaluate` — verifica consistência axioma+instâncias |
| `gateway/app/governance/killswitch.py` | Lógica pura: 3 gatilhos em OR |
| `gateway/app/governance/trail.py` | AuditTrail com hash SHA-256 reprodutível |
| `gateway/app/routes/govern.py` | Rota `/api/govern` SSE |
| `frontend/app/governance/` | Página `/governance` com badges + caixa de escalação |

### Cenários do Módulo 2

| ID | Descrição | Killswitch |
| --- | --- | --- |
| S13 | NPL Ratio — caminho feliz | Passivo (badges verdes) |
| S14 | Spread médio — recap S07 governado | Passivo (mesma resposta 15,36 p.p.) |
| S15 | Spread carteira volátil — cenário jewel | **Armed** (high_instance_variance, std dev ≈ 30 p.p.) |

## Referências da arquitetura aplicada

- **MCP** — Model Context Protocol (modelcontextprotocol.io)
- **Basel III / Bacen Resolução 4.557** — definição de default ≥ 90 DPD
- **Knowledge Graphs em finanças** — práticas amplamente documentadas em
  bancos europeus desde 2018 (BBVA, ING, Goldman Sachs).
