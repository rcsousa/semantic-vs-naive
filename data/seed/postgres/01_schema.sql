-- =============================================================================
-- Backend determinístico: o "ground truth" do banco.
-- Toda métrica de negócio que requer EXATIDÃO é calculada aqui em SQL puro.
-- O agente semântico chama estas views via mcp-metrics.
-- =============================================================================

CREATE TABLE customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('RETAIL','PRIVATE','SME','CORPORATE')),
  onboarding_date DATE NOT NULL,
  risk_rating TEXT CHECK (risk_rating IN ('AA','A','B','C','D','E','F','G','H'))
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer(id),
  type TEXT NOT NULL CHECK (type IN ('CHECKING','SAVINGS')),
  opened_at DATE NOT NULL,
  closed_at DATE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE TABLE credit_contract (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer(id),
  product TEXT NOT NULL CHECK (product IN ('PERSONAL_LOAN','MORTGAGE','AUTO_LOAN','CREDIT_CARD','OVERDRAFT','WORKING_CAPITAL')),
  principal NUMERIC(18,2) NOT NULL,
  interest_rate_aa NUMERIC(8,5) NOT NULL,
  start_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','PAID_OFF','WRITTEN_OFF','RENEGOTIATED'))
);

CREATE TABLE payment (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES credit_contract(id),
  due_date DATE NOT NULL,
  paid_date DATE,
  amount_due NUMERIC(18,2) NOT NULL,
  amount_paid NUMERIC(18,2)
);

CREATE TABLE collateral (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES credit_contract(id),
  type TEXT NOT NULL CHECK (type IN ('REAL_ESTATE','VEHICLE','FINANCIAL','GUARANTOR')),
  appraised_value NUMERIC(18,2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- VIEWS: as definições "axiomáticas" do domínio. UMA fonte da verdade.
-- ----------------------------------------------------------------------------

-- Days past due por parcela (referência: hoje fictício 2025-12-01)
CREATE OR REPLACE FUNCTION ref_today() RETURNS DATE AS $$
  SELECT DATE '2025-12-01'
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE VIEW v_payment_dpd AS
SELECT
  p.id,
  p.contract_id,
  p.due_date,
  p.paid_date,
  p.amount_due,
  p.amount_paid,
  CASE
    WHEN p.paid_date IS NULL AND ref_today() > p.due_date
      THEN (ref_today() - p.due_date)
    WHEN p.paid_date IS NOT NULL AND p.paid_date > p.due_date
      THEN (p.paid_date - p.due_date)
    ELSE 0
  END AS days_past_due
FROM payment p;

-- AX-DEFAULT-90 — clientes inadimplentes
CREATE OR REPLACE VIEW v_customer_default AS
SELECT
  c.id AS customer_id,
  MAX(d.days_past_due) AS days_past_due_max,
  COUNT(*) FILTER (WHERE d.days_past_due >= 90) AS open_overdue_90
FROM customer c
JOIN credit_contract k ON k.customer_id = c.id
JOIN v_payment_dpd d ON d.contract_id = k.id AND d.paid_date IS NULL
GROUP BY c.id
HAVING MAX(d.days_past_due) >= 90;

-- AX-ACTIVE-CUSTOMER — clientes ativos
CREATE OR REPLACE VIEW v_active_customer AS
SELECT DISTINCT c.id AS customer_id
FROM customer c
LEFT JOIN account a ON a.customer_id = c.id AND a.closed_at IS NULL
LEFT JOIN credit_contract k ON k.customer_id = c.id AND k.status = 'ACTIVE'
WHERE a.id IS NOT NULL OR k.id IS NOT NULL;

-- AX-EXPOSURE — exposição por contrato e por cliente
CREATE OR REPLACE VIEW v_contract_outstanding AS
SELECT
  k.id AS contract_id,
  k.customer_id,
  k.principal - COALESCE(SUM(p.amount_paid) FILTER (WHERE p.paid_date IS NOT NULL), 0) AS outstanding_principal,
  k.status
FROM credit_contract k
LEFT JOIN payment p ON p.contract_id = k.id
GROUP BY k.id, k.customer_id, k.principal, k.status;

CREATE OR REPLACE VIEW v_exposure AS
SELECT
  customer_id,
  SUM(outstanding_principal) AS exposure
FROM v_contract_outstanding
WHERE status IN ('ACTIVE','RENEGOTIATED')
GROUP BY customer_id;

-- AX-NPL-RATIO — NPL da carteira
CREATE OR REPLACE VIEW v_npl_ratio AS
WITH total AS (SELECT SUM(exposure) AS s FROM v_exposure),
default_exposure AS (
  SELECT COALESCE(SUM(e.exposure), 0) AS s
  FROM v_exposure e
  JOIN v_customer_default d ON d.customer_id = e.customer_id
)
SELECT
  default_exposure.s AS npl_exposure,
  total.s AS total_exposure,
  CASE WHEN total.s > 0 THEN default_exposure.s / total.s ELSE 0 END AS npl_ratio
FROM total, default_exposure;
