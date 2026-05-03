# Glossário Bancário (corpus para o RAG ingênuo)

> Este documento é a fonte que o agente **naive** consulta via similaridade
> vetorial. Contém termos parecidos, contradições propositais e linguagem
> de marketing — exatamente o que o RAG sozinho enfrenta no mundo real.

## Cliente Ativo
Cliente ativo é aquele que utiliza nossos serviços. Em campanhas, dizemos
"cliente ativo" para qualquer um que tenha logado no app nos últimos 30 dias.
Já no relatório regulatório, cliente ativo significa ter ao menos um produto
em vigor. Em conversas com a área de marketing, chamamos de "cliente engajado".

## Cliente Inadimplente
Inadimplente é aquele que não pagou. Coloquialmente, qualquer atraso já é
"inadimplência". Para fins regulatórios, no entanto, o critério rigoroso é
o da Resolução Bacen e Basel III: ≥ 90 dias em atraso. Bancos diferentes
podem ter políticas internas mais conservadoras (ex.: 60 dias).

## Atraso
Atraso ocorre quando o pagamento não foi feito até a data de vencimento.
"Cliente atrasado" não é necessariamente "cliente inadimplente". Veja o
verbete de Inadimplência.

## Spread
Spread é a diferença entre a taxa cobrada e o custo do dinheiro para o banco.
Há duas convenções: spread sobre CDI (taxa - CDI) e spread sobre funding
(taxa - custo de captação real). Em conversas comerciais, "spread" geralmente
significa o primeiro.

## NPL
Non-Performing Loans. Operações em default conforme critério regulatório.
A relação NPL/Carteira é o NPL Ratio, métrica chave de qualidade de crédito.

## Carteira
Soma do principal em aberto dos contratos vivos. "Carteira ativa" e
"carteira em curso" são sinônimos.

## Exposição (EAD)
Exposição é o quanto o banco pode perder se um cliente entrar em default.
Para contratos lineares, é o saldo devedor. Para revolvers (cartão,
cheque especial), Basel calcula com fator de conversão de crédito (CCF).
Para a demo, simplificamos: EAD = saldo devedor.

## LTV
Loan-to-Value. Razão entre o principal e o valor da garantia. Quanto menor,
mais protegido o banco está.

## Cliente Perdido / Churn
Cliente que encerrou o relacionamento. No mercado, "churn" é amplamente
usado, mas a definição varia: alguns consideram churn quando todas as contas
estão fechadas; outros usam inatividade ≥ 6 meses; outros usam saldo zero.
