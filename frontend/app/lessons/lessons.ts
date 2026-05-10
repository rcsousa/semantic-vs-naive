export type Lesson = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  body: string;             // markdown
  exercise?: {
    title: string;
    question: string;
    scenario_id?: string;
    expectation_pt: string;
  };
};

export const LESSONS: Lesson[] = [
  {
    id: 1,
    slug: "ontologia",
    title: "1 · Por que ontologia explícita?",
    subtitle: "Sem contrato semântico, todo agente é uma loteria.",
    body: `
**Problema concreto.** Pergunte a três áreas o que é "cliente ativo".
A área de marketing dirá "logou no app nos últimos 30 dias". Compliance dirá
"tem ao menos um produto vivo". Análise dirá "saldo médio > 0 nos últimos 90 dias".
Todas estão certas — para si.

**O que falta?** Um *contrato* que diga: "para a métrica X, cliente ativo é
exatamente isto, com esta query SQL". Isto é uma *ontologia* aplicada.

**Sem ontologia, o agente:**
- Concatena trechos de documentos (cada um usa um sentido diferente).
- Decide "por consenso textual", o que tende a ser a definição mais comum, não
  a correta.
- Erra silenciosamente (a resposta soa autoritativa).

**Com ontologia explícita, o agente:**
- Resolve o termo ANTES de calcular ("'cliente ativo' → AX-ACTIVE-CUSTOMER").
- Carrega a regra formal e a query canônica.
- Cita a regra usada na resposta (rastreável e auditável).

**Onde isto está nesta demo.** Veja \`data/ontology/banking.json\`. Cada classe,
relação, axioma e métrica é JSON com um \`id\` que o agente pode chamar.
`,
    exercise: {
      title: "Pratique: cliente ativo",
      question: "Quantos clientes ativos temos?",
      scenario_id: "S03",
      expectation_pt:
        "O agente naive frequentemente conta TODOS os clientes da base ou apenas os 'logados'. O semântico aplica AX-ACTIVE-CUSTOMER e responde 7.",
    },
  },

  {
    id: 2,
    slug: "desambiguacao",
    title: "2 · Desambiguação de termos",
    subtitle: "Atrasado ≠ inadimplente. Dois termos, duas verdades.",
    body: `
**A regra de ouro.** Antes de qualquer cálculo, *resolva o termo*. Isto deve ser
uma chamada de tool explícita, não um chute.

Na demo, o servidor \`mcp-disambiguation\` expõe \`disambig.resolve_term(term)\`.
Para "atrasado", ele responde:

\`\`\`json
{
  "resolves_to": "AX-DEFAULT-90",
  "type": "axiom",
  "warn": "Atraso ≠ Inadimplência. Atraso é qualquer days_past_due > 0; inadimplência exige ≥ 90."
}
\`\`\`

O \`warn\` é a peça-chave: o agente recebe um aviso explícito. Ele pode então
decidir: "o usuário disse 'atrasado'; mas em compliance isso vira AX-DEFAULT-90.
Vou explicitar essa decisão na resposta."

**Por que isto não é só "system prompt"?** Porque um system prompt é estático e
limitado. O dicionário de sinônimos cresce com o domínio, é versionado, e pode
ser auditado fora do LLM.
`,
    exercise: {
      title: "Pratique: atraso vs inadimplência",
      question: "O cliente C004 está inadimplente?",
      scenario_id: "S09",
      expectation_pt:
        "C004 tem 30 dias de atraso. O agente naive frequentemente diz 'sim'. O semântico aplica AX-DEFAULT-90 (≥90) e responde NÃO, citando o axioma.",
    },
  },

  {
    id: 3,
    slug: "metricas-deterministicas",
    title: "3 · Métricas determinísticas (a verdade)",
    subtitle: "O LLM não calcula. Ele lê o backend.",
    body: `
LLMs alucinam números. A solução não é "treinar mais", é *retirar a aritmética
do LLM*. Cada métrica de negócio precisa de uma **query canônica** publicada,
versionada e testável.

Na demo:

- Postgres tem tabelas operacionais e *views* que materializam axiomas:
  \`v_customer_default\`, \`v_active_customer\`, \`v_exposure\`, \`v_npl_ratio\`.
- O servidor \`mcp-metrics\` expõe \`metrics.compute(id)\`. \`id\` é o axioma
  ou métrica (ex.: \`AX-NPL-RATIO\`).
- A query é fixa, escrita por humano, revisada em PR.

O agente nunca *escreve* SQL ad-hoc para métrica. Ele *escolhe* uma métrica
publicada. Se a pergunta não tem métrica correspondente, ele recusa ou pede.

**Trade-off.** Você precisa modelar suas métricas explicitamente. Isto é uma
*feature*, não bug — força a organização a alinhar o que cada KPI significa.
`,
    exercise: {
      title: "Pratique: NPL Ratio",
      question: "Qual o NPL Ratio da carteira?",
      scenario_id: "S06",
      expectation_pt:
        "Naive frequentemente conta operações em vez de exposição. Semântico chama metrics.compute('AX-NPL-RATIO') e devolve o número exato (≈0.15%).",
    },
  },

  {
    id: 4,
    slug: "axiomas",
    title: "4 · Axiomas como guarda-chuva",
    subtitle: "Regras que o agente respeita por design.",
    body: `
Um axioma é uma regra que **não pode ser violada** pelo sistema. Em crédito,
exemplos canônicos:

- **AX-DEFAULT-90**: cliente em default ⇔ existe parcela em aberto com DPD ≥ 90.
- **AX-EXPOSURE**: exposure(c) = Σ outstanding_principal de contratos vivos.

O fluxo do agente semântico é:

1. \`disambig\` mapeia o termo para um axioma.
2. \`ontology.get_axiom(id)\` retorna a regra em PT-BR, em lógica formal e a
   query canônica.
3. \`metrics.compute(id)\` executa a query.
4. O LLM redige a resposta **citando o axioma** e os números do passo 3.

Resultado: a resposta é sempre rastreável a uma regra publicada. Se a regra
muda (ex.: o BCB altera o threshold), você muda em um lugar.
`,
    exercise: {
      title: "Pratique: axioma sob a lupa",
      question: "Liste os clientes que NÃO estão ativos.",
      scenario_id: "S04",
      expectation_pt:
        "Sem axioma, naive pode inverter mal a lógica. Semântico aplica AX-ACTIVE-CUSTOMER e responde {C006}.",
    },
  },

  {
    id: 5,
    slug: "semantica-previne-alucinacao",
    title: "5 · Semântica previne alucinação numérica",
    subtitle: "O LLM não calcula. Ele lê o backend — ou inventa.",
    body: `
**O problema.** Pergunte a um LLM sem ontologia: "Qual a exposição do C002?"
Ele vai *inventar* um cálculo. Pode somar o principal bruto, ignorar amortizações,
misturar contratos PAID_OFF. O número soa autoritativo mas está errado.

**Por que isso acontece?** Porque o LLM não tem acesso à definição formal de
"exposição" — ele apenas extrapola do treinamento, onde múltiplas convenções
convivem (EAD, saldo contratado, saldo devedor, etc.).

**A solução semântica:**

1. O agente chama \`disambig.resolve_term("exposição")\` → recebe o axioma
   \`AX-EXPOSURE\`.
2. Chama \`ontology.get_axiom("AX-EXPOSURE")\` → lê a regra formal:
   *"soma do outstanding_principal de contratos ACTIVE ou RENEGOTIATED"*.
3. Chama \`metrics.compute("AX-EXPOSURE", filter_customer_id="C002")\` →
   executa a query canônica. **O LLM não faz aritmética — ele lê o resultado.**

**Resultado:** a resposta é rastreável a uma regra publicada. Se a regra mudar
(ex.: BCB altera o cálculo de EAD), você muda *em um lugar* e todos os agentes
passam a usar a nova definição automaticamente.
`,
    exercise: {
      title: "Pratique: exposição vs. saldo bruto",
      question: "Qual a exposição total do cliente C002?",
      scenario_id: "S05",
      expectation_pt:
        "Naive soma o saldo original do contrato (R$ 8.500 — dado errado do relatório). Semântico aplica AX-EXPOSURE e retorna R$ 7.000,00 (saldo em aberto real). Eval: naive=0, semantic=1.",
    },
  },

  {
    id: 6,
    slug: "raciocinio-sobre-grafos",
    title: "6 · Relações que o RAG não vê",
    subtitle: "Garantias, colaterais e LTV exigem travessia de grafo.",
    body: `
**O problema.** A pergunta "Quais contratos imobiliários têm LTV < 80%?" exige:

1. Saber que LTV = principal ÷ valor de avaliação do imóvel.
2. Saber que a relação entre contrato e imóvel se chama \`SECURED_BY\`.
3. Atravessar o grafo: \`CreditContract → SECURED_BY → Collateral\`.

Um agente RAG puro não tem o grafo. Ele vê documentos de texto e pode:
- Não encontrar a relação (responde vazio ou errado).
- Usar o LTV declarado pelo cliente na concessão (obsoleto, pré-reavaliação).

**A solução semântica:**

1. \`disambig.resolve_term("ltv abaixo de 80")\` → axioma \`AX-MORTGAGE-LTV-SAFE\`.
2. \`metrics.compute("AX-MORTGAGE-LTV-SAFE")\` → executa a query canônica que
   faz o JOIN \`credit_contract ↔ collateral\` com filtro LTV < 0.8.
3. Resultado: K004 (LTV 73,8%) — determinístico, rastreável.

**O insight fundamental.** Conhecimento de domínio não é só *texto* —
é *estrutura de relações*. Ontologia mapeia essas relações; grafo as armazena.
O agente semântico usa ambos. O agente naive usa apenas texto.
`,
    exercise: {
      title: "Pratique: contratos com garantia adequada",
      question: "Quais contratos imobiliários são garantidos por imóvel próprio com LTV abaixo de 80%?",
      scenario_id: "S08",
      expectation_pt:
        "Naive perde a relação SECURED_BY e frequentemente erra o denominador do LTV. Semântico aplica AX-MORTGAGE-LTV-SAFE via JOIN correto e retorna K004. Eval: naive→0, semantic→1.",
    },
  },

  {
    id: 7,
    slug: "casos-de-borda",
    title: "7 · Casos de borda: onde o RAG é mais perigoso",
    subtitle: "O agente confiante e errado é pior que o incerto.",
    body: `
**O paradoxo dos casos de borda.** C004 tem 31 dias de atraso — está
*em atraso*, mas *não inadimplente* (o critério regulatório é 90 dias, BCB).

Para o agente naive, "C004 está inadimplente?" é uma pergunta fácil:
os documentos dizem "qualquer atraso é inadimplência" (critério comercial,
não regulatório). Ele responde **Sim** com confiança.

Para o agente semântico, a pergunta dispara um protocolo:

1. \`disambig.suggest("C004 está inadimplente?")\` detecta "inadimplente" →
   sinaliza que o critério correto é \`AX-DEFAULT-90\` (DPD ≥ 90 dias).
2. \`metrics.compute("AX-DEFAULT-90", filter_customer_id="C004")\` →
   retorna 0 linhas (C004 não está na view \`v_customer_default\`).
3. Resposta: **Não** — C004 tem 31 DPD, abaixo do limiar de 90 dias.

**Por que isso importa em produção?** Uma decisão de cobrança baseada na
resposta errada do agente naive cria:
- Relacionamento danificado com cliente que *tecnicamente não é devedor*.
- Risco regulatório (BCB exige que o critério de inadimplência seja o formal).

A ontologia não é só um detalhe técnico. É a diferença entre certo e errado
em uma decisão de negócio.
`,
    exercise: {
      title: "Pratique: o cliente em atraso que não é inadimplente",
      question: "O cliente C004 está inadimplente?",
      scenario_id: "S09",
      expectation_pt:
        "Naive frequentemente responde Sim (usa critério comercial de 30 dias). Semântico aplica AX-DEFAULT-90 (≥90 dias) e responde Não, citando o axioma. Eval: naive=0, semantic=1.",
    },
  },

  {
    id: 8,
    slug: "evals-como-prova",
    title: "8 · Evals como prova de qualidade semântica",
    subtitle: "RAGAS: correto, fundamentado, completo, coerente.",
    body: `
Como *provar* que o agente semântico é melhor que o naive? Intuição não basta.

Esta demo usa **evals determinísticos com RAGAS-style scoring**. Cada cenário tem:

- **Ground truth** obtido via SQL canônico contra o banco real.
- **4 dimensões de avaliação:**
  - *Correto*: o valor extraído bate com o ground truth?
  - *Fundamentado*: a resposta cita axioma ou fonte verificável?
  - *Completo*: a resposta cobre todas as entidades/valores pedidos?
  - *Coerente*: a resposta tem estrutura e explicação, não só o número?

**O padrão que emerge** ao rodar todos os 12 cenários:

| Dimensão | Naive | Semântico |
|----------|-------|-----------|
| Correto | baixo | alto |
| Fundamentado | baixo | alto (cita AX-...) |
| Completo | médio | alto |
| Coerente | médio | médio-alto |

O agente naive pode ser *coerente* (escreve bem), mas erra em *correto* e
*fundamentado* — e é justamente nessas duas que os erros custam dinheiro.

**A prática de ter evals sobre ground truth determinístico** é o que transforma
"o agente parece bom" em "o agente é provadamente melhor em X% dos casos".
`,
    exercise: {
      title: "Pratique: compare as 4 dimensões RAGAS",
      question: "Qual o NPL Ratio da carteira?",
      scenario_id: "S06",
      expectation_pt:
        "Naive responde ~5% (critério comercial de 30 dias). Semântico aplica AX-NPL-RATIO (Basel III, DPD≥90) e retorna ~0,14%. RAGAS: naive tem coerência boa mas correto e fundamentado baixos; semântico tem todas as dimensões altas.",
    },
  },

  // ── Módulo 2: Governança em Runtime ─────────────────────────────────────────

  {
    id: 9,
    slug: "calcular-nao-basta",
    title: "9 · Calcular não basta",
    subtitle: "Velocidade vira passivo sem freio em ambiente regulado.",
    body: `
**A tese do módulo.** Até aqui vimos como calcular corretamente via ontologia,
axiomas e métricas determinísticas. Isso resolve o problema da *exatidão*.
Mas em ambiente regulado há três competências distintas que um agente de
produção precisa:

1. **Calcular** — o número correto, com rastreabilidade ao axioma.
2. **Julgar** — verificar se a própria resposta é consistente com o que foi computado.
3. **Parar** — saber quando não entregar, escalando para revisão humana.

A *auditabilidade* não é um requisito adicional. É o subproduto natural quando
as três funcionam juntas: cada decisão tem inputs, outputs, timestamp e hash
reprodutível.

**Por que "calcular não basta"?** Considere o cenário onde o agente calcula
corretamente a média de spread de uma carteira, mas os contratos individuais
têm dispersão enorme — alguns a 1 p.p., outros a 80 p.p. O número médio está
certo. A decisão de entregá-lo sem contexto pode estar errada.

**Onde isso está nesta demo.** Veja \`gateway/app/routes/govern.py\` — a rota
\`/api/govern\` implementa o pipeline completo: calculate → judge → killswitch →
respond/escalate. Cada step é registrado no \`AuditTrail\` com hash SHA-256
reprodutível.

**Exercício de antecipação.** Antes de rodar S15, escreva sua expectativa:
o agente vai entregar ou escalar? Por quê?
`,
    exercise: {
      title: "Pratique: antecipe o S15",
      question: "Qual o spread médio na carteira volátil?",
      scenario_id: "S15",
      expectation_pt:
        "Antes de rodar: o agente calculará corretamente (judge consistent), mas o killswitch disparará pelo gatilho de variância (std dev ≈ 30 p.p. > 25 p.p. threshold). A resposta será escalada mesmo com o número correto.",
    },
  },

  {
    id: 10,
    slug: "llm-as-judge",
    title: "10 · LLM-as-judge ancorado em ontologia",
    subtitle: "Judge de vibe-check vs. judge de axioma. A diferença importa.",
    body: `
**Dois tipos de judge.** Um "vibe-check" avalia fluência e plausibilidade:
"a resposta parece certa?". Um judge ancorado em ontologia avalia uma coisa
específica: a resposta numérica é *consistente* com o axioma declarado aplicado
sobre as instâncias listadas?

O \`mcp-judge\` desta demo implementa o segundo tipo.

**Três classes de veredicto:**
- **\`consistent\`** — refazendo o cálculo com o axioma sobre as instâncias,
  o resultado bate dentro de tolerância de arredondamento.
- **\`inconsistent\`** — refazendo, diverge: cálculo errado, definição diferente
  ou instâncias indevidas.
- **\`insufficient_evidence\`** — impossível verificar (axioma mal definido,
  instâncias ausentes). Use com parcimônia — é o "não sei" do judge.

**Como está implementado.** Veja \`mcp-servers/judge-mcp/server.py\`. O system
prompt proíbe vibe-check explicitamente: *"Avalie uma única coisa: a resposta
numérica é consistente com o axioma?"*. O parser do output é tolerante (aceita
fences markdown, texto extra) com fallback seguro para \`insufficient_evidence\`.

Em modo MOCK (sem chave Azure), o judge retorna \`consistent\` deterministicamente
— não interfere no fluxo; o killswitch ainda pode disparar pelos outros gatilhos.

**O cenário S13 é o caminho feliz:** pergunta sobre NPL Ratio (métrica que existe,
axioma claro, instâncias coerentes). Judge aprova, killswitch passivo.
`,
    exercise: {
      title: "Pratique: caminho feliz com judge",
      question: "Qual o NPL Ratio da carteira?",
      scenario_id: "S13",
      expectation_pt:
        "Judge retorna consistent (cálculo AX-NPL-RATIO verificável). Killswitch passivo. Badges: Calcular ✓ / Julgar consistent / Parar passivo. Hash visível e copiável.",
    },
  },

  {
    id: 11,
    slug: "killswitch",
    title: "11 · Killswitch — o freio do sistema",
    subtitle: "Três gatilhos em OR. O agente que sabe quando parar.",
    body: `
**Design fundamental.** O killswitch não é o agente tomando uma decisão — é o
*sistema de orquestração* aplicando regras externas ao agente. O agente pode
fazer tudo certo e o killswitch ainda assim disparar.

Três gatilhos independentes em OR (qualquer um é suficiente para escalar):

**1. RAGAS abaixo do piso** (default 0,70)
O eval automático desconfia. Em compliance crítico, suba para 0,85.

**2. Judge não-consistent**
Segunda voz semântica discorda — \`inconsistent\` ou \`insufficient_evidence\`.
Uma segunda opinião independente sobre o mesmo cálculo.

**3. Variância das instâncias acima do teto** (default 25 p.p.)
Os contratos individuais discordam entre si. O número médio pode estar certo,
mas a dispersão indica que a média esconde heterogeneidade relevante.
*Este é o gatilho do S15 — o mais importante pedagogicamente.*

**Por que OR e não AND?** Redes de proteção sobrepostas. Single point of
failure no killswitch é mais perigoso do que falsos positivos. Em produção,
tune os thresholds — não remova gatilhos.

**Implementação.** Veja \`gateway/app/governance/killswitch.py\` — lógica pura,
sem LLM, testável. Os testes em \`gateway/tests/governance/test_killswitch.py\`
cobrem cada gatilho isolado e combinações.

**O ponto do S15:** o agente calcula corretamente (judge consistent, RAGAS alto),
mas os contratos KV têm spreads de 1 a 80 p.p. (std dev ≈ 30 p.p. > 25 p.p.).
O killswitch para — não porque o agente errou, mas porque o sistema reconhece
que entregar uma média sobre uma carteira tão dispersa sem aviso é irresponsável.
`,
    exercise: {
      title: "Pratique: S15 — o freio do sistema",
      question: "Qual o spread médio na carteira volátil?",
      scenario_id: "S15",
      expectation_pt:
        "Badges: Calcular ✓ / Julgar consistent / Parar armed. Caixa âmbar substitui a resposta. Trigger high_instance_variance listado. Hash visível. O agente calculou certo — o sistema parou mesmo assim.",
    },
  },

  {
    id: 12,
    slug: "trail-auditavel",
    title: "12 · Trail auditável como subproduto",
    subtitle: "O hash de reprodutibilidade: a métrica que um auditor verifica em segundos.",
    body: `
**A propriedade central.** Dois runs do mesmo cálculo determinístico sobre
os mesmos dados produzem o **mesmo hash** apesar de timestamps diferentes.
Drift no hash entre runs = drift real (ontologia mudou, regra mudou,
contratos mudaram). É a métrica que um auditor verifica em segundos.

**Como o hash é calculado.** Veja \`gateway/app/governance/trail.py\`:

\`\`\`python
def _canonical(self) -> dict:
    return {
        "question": self.question,
        "steps": [
            {"name": s.name, "inputs": s.inputs, "outputs": s.outputs}
            for s in self.steps
        ],
    }

def reproducibility_hash(self) -> str:
    canonical_json = json.dumps(
        self._canonical(), sort_keys=True, ensure_ascii=False
    )
    return hashlib.sha256(canonical_json.encode()).hexdigest()
\`\`\`

Timestamps, request_id e durations são **excluídos** do canonical. Eles variam
entre runs; não fazem parte do conteúdo auditável.

**O trail acumula 4 steps** no pipeline governado:
\`calculate → judge → killswitch → respond/escalate\`

Cada step tem inputs, outputs e o próprio hash reflete todos eles. Se qualquer
axioma, instância ou veredicto mudar, o hash muda.

**Uso em produção.** Armazene o hash junto à resposta entregue. Para re-auditoria:
re-execute o pipeline com os mesmos dados → compare hashes. Match = reprodutível.
Mismatch = investigar o que mudou entre as execuções.

*"O agente que entrega valor em ambiente regulado é o que sabe quando não entregar."*
`,
    exercise: {
      title: "Pratique: reprodutibilidade do hash",
      question: "Qual o NPL Ratio da carteira?",
      scenario_id: "S13",
      expectation_pt:
        "Execute S13 duas vezes seguidas. Copie o hash das duas execuções e compare. Devem ser idênticos — mesmo cálculo determinístico, mesmo axioma, mesmas instâncias. Isso é o que o auditor verifica.",
    },
  },
];
