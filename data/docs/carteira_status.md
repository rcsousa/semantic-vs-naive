# Carteira de Crédito — Dashboard Operacional

> Sistema: CRM Comercial — Atualização: mensal
> Critérios: políticas internas da área de relacionamento (não regulatórias)

## Situação dos Clientes

| Cliente | Nome          | Status Atual         | Atraso (dias) | Observação                         |
|---------|---------------|----------------------|---------------|------------------------------------|
| C001    | Ana Souza     | Regular              | 0             | Crédito imobiliário em dia         |
| C002    | Bruno Lima    | **Inadimplente**     | 127           | Em cobrança ativa. Contrato K002.  |
| C003    | Carla Mendes  | Regular              | 0             | Cliente premier                    |
| C004    | Diego Faria   | **Inadimplente**     | 31            | Notificado. Aguarda regularização. |
| C005    | Eva Torres    | Regular (Reneg.)     | 0             | Renegociou em 2023                 |
| C006    | Felipe Gomes  | Encerrado            | —             | Conta fechada, write-off           |
| C007    | Gabi Rocha    | Regular              | 0             | Novo cliente (2024)                |

> **Critério de inadimplência usado neste relatório**: qualquer atraso superior a
> 30 dias (critério da área comercial para acionar cobrança preventiva).

## Totais da Carteira

- **Clientes com produto vigente**: C001, C002, C003, C004, C005, C006, C007 — **7 clientes ativos**
- **Inadimplentes (critério 30 d)**: C002, C004
- **Clientes sem pendências**: C001, C003, C005, C007

## Indicadores Financeiros (Estimativas Comerciais)

| Indicador             | Valor estimado      | Observação                              |
|-----------------------|---------------------|-----------------------------------------|
| Carteira total        | R$ 6.200.000,00     | Saldo dos contratos na data de emissão  |
| NPL Ratio (interno)   | 5,2%                | Base: critério 30 dias                  |
| Spread médio          | 20,5% a.a.          | Estimativa comercial s/ CDI             |
| Contratos vivos       | 7                   | Inclui renegociados, exclui write-off   |
| Exposição C002        | R$ 8.500,00         | Saldo do contrato na originação         |

## Contratos Imobiliários

| Contrato | Cliente | Produto  | Principal    | Valor Imóvel  | LTV estimado |
|----------|---------|----------|--------------|---------------|--------------|
| K004     | C004    | MORTGAGE | R$ 480.000   | R$ 650.000    | 73,8%        |

> LTV calculado sobre valor declarado na concessão. Sem reavaliação formal.

## Canais de Atendimento

| Canal            | Tipo        | Status |
|------------------|-------------|--------|
| App Mobile       | Digital     | Ativo  |
| Internet Banking | Digital     | Ativo  |
| Agência Centro   | Presencial  | Ativo  |
| Call Center 24h  | Telefônico  | Ativo  |
