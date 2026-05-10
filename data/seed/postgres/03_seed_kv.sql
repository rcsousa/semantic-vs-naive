-- =============================================================================
-- Carteira Volátil (KV) — seed do Módulo 2: Governança em Runtime
--
-- Idempotente: ON CONFLICT DO NOTHING garante que pode ser executado múltiplas
-- vezes (a cada 'docker compose run --rm seeder') sem duplicar dados.
--
-- 6 contratos RENEGOTIATED com spreads extremamente heterogêneos (1–80 p.p.),
-- std dev ≈ 30 p.p. → dispara gatilho 3 do killswitch (threshold 25 p.p.)
-- mesmo com judge=consistent e RAGAS alto — ponto pedagógico do S15.
-- =============================================================================

INSERT INTO customer (id, name, segment, onboarding_date, risk_rating) VALUES
  ('C009', 'Fundo Crédito Volátil SA', 'CORPORATE', '2023-01-15', 'C')
ON CONFLICT (id) DO NOTHING;

INSERT INTO credit_contract (id, customer_id, product, principal, interest_rate_aa, start_date, maturity_date, status) VALUES
  ('KV001', 'C009', 'PERSONAL_LOAN',    50000.00, 0.115, '2023-03-01', '2026-03-01', 'RENEGOTIATED'),
  ('KV002', 'C009', 'WORKING_CAPITAL',  80000.00, 0.155, '2023-04-01', '2026-04-01', 'RENEGOTIATED'),
  ('KV003', 'C009', 'WORKING_CAPITAL', 120000.00, 0.205, '2023-05-01', '2026-05-01', 'RENEGOTIATED'),
  ('KV004', 'C009', 'CREDIT_CARD',      30000.00, 0.505, '2023-06-01', '2026-06-01', 'RENEGOTIATED'),
  ('KV005', 'C009', 'CREDIT_CARD',      20000.00, 0.755, '2023-07-01', '2026-07-01', 'RENEGOTIATED'),
  ('KV006', 'C009', 'PERSONAL_LOAN',    15000.00, 0.905, '2023-08-01', '2026-08-01', 'RENEGOTIATED')
ON CONFLICT (id) DO NOTHING;
