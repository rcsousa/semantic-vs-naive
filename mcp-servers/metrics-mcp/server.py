"""
metrics-mcp — backend determinístico de métricas de crédito.

CADA métrica aqui é a fonte da verdade. Calculada com SQL puro contra
as views do Postgres, que codificam os axiomas. Não há LLM no caminho.

Tools:
  - metrics.compute(axiom_or_metric_id, params)  -- ex: AX-DEFAULT-90
  - metrics.list()                                -- métricas/axiomas disponíveis
  - metrics.run_canonical_query(axiom_id)         -- exec direto da query do axioma
"""
from __future__ import annotations

import os

import psycopg
from psycopg.rows import dict_row

from common.mcp_base import MCPServer

DSN = os.environ["POSTGRES_DSN"]


def _q(sql: str, params: tuple | None = None) -> list[dict]:
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            try:
                return cur.fetchall()
            except psycopg.ProgrammingError:
                return []


METRIC_REGISTRY = {
    # axioma -> sql canônico
    "AX-DEFAULT-90": {
        "label": "Clientes inadimplentes (DPD ≥ 90)",
        "sql": "SELECT customer_id, days_past_due_max FROM v_customer_default ORDER BY customer_id",
    },
    "AX-ACTIVE-CUSTOMER": {
        "label": "Clientes ativos",
        "sql": "SELECT customer_id FROM v_active_customer ORDER BY customer_id",
    },
    "AX-EXPOSURE": {
        "label": "Exposição por cliente",
        "sql": "SELECT customer_id, exposure FROM v_exposure ORDER BY customer_id",
    },
    "AX-NPL-RATIO": {
        "label": "NPL Ratio",
        "sql": "SELECT npl_exposure, total_exposure, npl_ratio FROM v_npl_ratio",
    },
    "AX-LTV": {
        "label": "LTV por contrato com colateral",
        "sql": (
            "SELECT k.id AS contract_id, k.product, g.type AS collateral_type, "
            "k.principal, g.appraised_value, "
            "(k.principal/g.appraised_value)::numeric(10,4) AS ltv "
            "FROM credit_contract k JOIN collateral g ON g.contract_id=k.id"
        ),
    },
    "AX-OVERDUE-NOT-DEFAULT": {
        "label": "Clientes em atraso mas NÃO inadimplentes (0 < DPD < 90)",
        "sql": (
            "SELECT DISTINCT k.customer_id, MAX(d.days_past_due) AS days_past_due_max "
            "FROM v_payment_dpd d "
            "JOIN credit_contract k ON k.id = d.contract_id "
            "WHERE d.paid_date IS NULL AND d.days_past_due > 0 AND d.days_past_due < 90 "
            "AND k.customer_id NOT IN (SELECT customer_id FROM v_customer_default) "
            "GROUP BY k.customer_id ORDER BY k.customer_id"
        ),
    },
    "AX-CHURN-90": {
        "label": "Clientes em churn",
        "sql": (
            "SELECT c.id AS customer_id "
            "FROM customer c "
            "WHERE NOT EXISTS (SELECT 1 FROM account a WHERE a.customer_id=c.id AND a.closed_at IS NULL) "
            "AND NOT EXISTS (SELECT 1 FROM credit_contract k WHERE k.customer_id=c.id AND k.status='ACTIVE')"
        ),
    },
    "Metric:Spread": {
        "label": "Spread sobre CDI",
        "sql": (
            "SELECT id AS contract_id, product, "
            "(interest_rate_aa - 0.105)::numeric(8,5) AS spread "
            "FROM credit_contract WHERE status='ACTIVE' ORDER BY id"
        ),
    },
    "Metric:PortfolioSize": {
        "label": "Carteira ativa total",
        "sql": "SELECT SUM(outstanding_principal) AS portfolio FROM v_contract_outstanding WHERE status IN ('ACTIVE','RENEGOTIATED')",
    },
    "Metric:ActiveCustomers": {
        "label": "Contagem de clientes ativos",
        "sql": "SELECT COUNT(*) AS active_customers FROM v_active_customer",
    },
    "AX-INACTIVE-CUSTOMER": {
        "label": "Clientes NÃO ativos (complemento de AX-ACTIVE-CUSTOMER)",
        "sql": (
            "SELECT id AS customer_id FROM customer "
            "WHERE id NOT IN (SELECT customer_id FROM v_active_customer) "
            "ORDER BY id"
        ),
    },
    "Metric:CheckingAccounts": {
        "label": "Contas correntes abertas",
        "sql": "SELECT COUNT(*) AS checking_accounts FROM account WHERE type='CHECKING' AND closed_at IS NULL",
    },
    "AX-MORTGAGE-LTV-SAFE": {
        "label": "Contratos imobiliários com LTV < 80% (garantia adequada)",
        "sql": (
            "SELECT k.id AS contract_id, k.customer_id, "
            "(k.principal::numeric / g.appraised_value::numeric)::numeric(6,4) AS ltv "
            "FROM credit_contract k JOIN collateral g ON g.contract_id = k.id "
            "WHERE k.product = 'MORTGAGE' AND g.type = 'REAL_ESTATE' "
            "AND (k.principal::numeric / g.appraised_value::numeric) < 0.8 "
            "ORDER BY k.id"
        ),
    },
}

server = MCPServer(name="metrics", version="1.0.0")


@server.tool(
    name="list",
    description="Lista todas as métricas/axiomas que o backend determinístico calcula.",
    input_schema={"type": "object", "properties": {}},
)
async def list_metrics():
    return {"metrics": [{"id": k, "label": v["label"]} for k, v in METRIC_REGISTRY.items()]}


@server.tool(
    name="compute",
    description=(
        "Calcula uma métrica/axioma de forma determinística. id deve ser um dos retornados "
        "por metrics.list(). Retorna rows com SQL puro contra as views do Postgres."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "ID do axioma (AX-...) ou métrica (Metric:...)"},
            "filter_customer_id": {"type": "string", "description": "Opcional: filtra por cliente."}
        },
        "required": ["id"]
    }
)
async def compute(id: str, filter_customer_id: str | None = None):  # noqa: A002
    entry = METRIC_REGISTRY.get(id)
    if not entry:
        raise ValueError(f"id desconhecido: {id}. Use metrics.list().")
    sql = entry["sql"]
    params: tuple = ()
    if filter_customer_id:
        # adiciona filtro no SQL apenas se faz sentido
        if "customer_id" in sql.lower():
            sql = f"SELECT * FROM ({sql}) sub WHERE customer_id = %s"
            params = (filter_customer_id,)
    rows = _q(sql, params)
    # converte Decimal/Date para JSON-serializável
    out = []
    for r in rows:
        out.append({k: (str(v) if not isinstance(v, (int, float, bool, type(None))) else v) for k, v in r.items()})
    return {"id": id, "label": entry["label"], "rows": out, "count": len(out)}


@server.tool(
    name="run_canonical_query",
    description="Executa diretamente a query canônica de um axioma (sem parâmetros).",
    input_schema={
        "type": "object",
        "properties": {"axiom_id": {"type": "string"}},
        "required": ["axiom_id"]
    }
)
async def run_canonical_query(axiom_id: str):
    return await compute(axiom_id)


if __name__ == "__main__":
    server.run()
