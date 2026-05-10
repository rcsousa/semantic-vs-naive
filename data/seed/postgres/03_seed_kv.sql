-- =============================================================================
-- Carteira Volátil (KV) — seed do Módulo 2: Governança em Runtime
--
-- 6 contratos renegociados com spreads extremamente heterogêneos,
-- usados exclusivamente pelo cenário S15 (killswitch via variância).
--
-- Status RENEGOTIATED: ficam fora do Metric:Spread (filtra status='ACTIVE'),
-- mas aparecem no Metric:SpreadVolatil (filtra id LIKE 'KV%').
--
-- Spreads sobre CDI 10,5%: 1, 5, 10, 40, 65, 80 p.p. → std dev ≈ 30 p.p.
-- Esse nível de dispersão dispara o gatilho 3 do killswitch (threshold 25 p.p.)
-- mesmo com judge=consistent e RAGAS alto — o ponto pedagógico do S15.
-- =============================================================================

INSERT INTO customer (id, name, segment, onboarding_date, risk_rating) VALUES
  ('C009', 'Fundo Crédito Volátil SA', 'CORPORATE', '2023-01-15', 'C');

-- KV001–KV006: mesmo cliente, produtos e spreads intencionalmente misturados.
-- Taxas anuais: 11,5% / 15,5% / 20,5% / 50,5% / 75,5% / 90,5%
INSERT INTO credit_contract (id, customer_id, product, principal, interest_rate_aa, start_date, maturity_date, status) VALUES
  ('KV001', 'C009', 'PERSONAL_LOAN',    50000.00, 0.115, '2023-03-01', '2026-03-01', 'RENEGOTIATED'),
  ('KV002', 'C009', 'WORKING_CAPITAL',  80000.00, 0.155, '2023-04-01', '2026-04-01', 'RENEGOTIATED'),
  ('KV003', 'C009', 'WORKING_CAPITAL', 120000.00, 0.205, '2023-05-01', '2026-05-01', 'RENEGOTIATED'),
  ('KV004', 'C009', 'CREDIT_CARD',      30000.00, 0.505, '2023-06-01', '2026-06-01', 'RENEGOTIATED'),
  ('KV005', 'C009', 'CREDIT_CARD',      20000.00, 0.755, '2023-07-01', '2026-07-01', 'RENEGOTIATED'),
  ('KV006', 'C009', 'PERSONAL_LOAN',    15000.00, 0.905, '2023-08-01', '2026-08-01', 'RENEGOTIATED');
