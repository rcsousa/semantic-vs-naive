-- =============================================================================
-- Seed didático: 8 clientes, contas, contratos e parcelas, com casos
-- propositadamente ambíguos para evidenciar a diferença naive vs semântico.
-- "Hoje" fictício = 2025-12-01 (ver ref_today()).
-- =============================================================================

INSERT INTO customer (id, name, segment, onboarding_date, risk_rating) VALUES
  ('C001', 'Ana Lima',           'RETAIL',    '2018-03-12', 'B'),
  ('C002', 'Bruno Souza',        'RETAIL',    '2020-06-01', 'D'),
  ('C003', 'Carla Mendes',       'PRIVATE',   '2016-09-22', 'A'),
  ('C004', 'Padaria Alvorada',   'SME',       '2019-11-04', 'C'),
  ('C005', 'Tech Holding S.A.',  'CORPORATE', '2014-01-15', 'AA'),
  ('C006', 'Diego Pereira',      'RETAIL',    '2022-02-08', 'E'),
  ('C007', 'Elaine Costa',       'RETAIL',    '2017-07-30', 'B'),
  ('C008', 'Mercado Bom Preço',  'SME',       '2021-05-19', 'C');

INSERT INTO account (id, customer_id, type, opened_at, closed_at, balance) VALUES
  ('A001', 'C001', 'CHECKING', '2018-03-12', NULL,         3120.50),
  ('A002', 'C001', 'SAVINGS',  '2019-01-10', NULL,        15000.00),
  ('A003', 'C002', 'CHECKING', '2020-06-01', NULL,          120.00),
  ('A004', 'C003', 'CHECKING', '2016-09-22', NULL,        87000.00),
  ('A005', 'C004', 'CHECKING', '2019-11-04', NULL,        12000.00),
  ('A006', 'C005', 'CHECKING', '2014-01-15', NULL,      1500000.00),
  ('A007', 'C006', 'CHECKING', '2022-02-08', '2025-09-15',     0.00),  -- conta fechada
  ('A008', 'C007', 'CHECKING', '2017-07-30', NULL,         4200.00),
  ('A009', 'C008', 'CHECKING', '2021-05-19', NULL,         8500.00);

-- Contratos
INSERT INTO credit_contract (id, customer_id, product, principal, interest_rate_aa, start_date, maturity_date, status) VALUES
  ('K001', 'C001', 'PERSONAL_LOAN', 12000.00, 0.18,  '2024-08-01', '2026-08-01', 'ACTIVE'),
  ('K002', 'C002', 'CREDIT_CARD',    5000.00, 0.42,  '2023-04-01', '2030-04-01', 'ACTIVE'),
  ('K003', 'C002', 'OVERDRAFT',      2000.00, 0.65,  '2024-01-01', '2026-01-01', 'ACTIVE'),
  ('K004', 'C003', 'MORTGAGE',     650000.00, 0.099, '2020-09-01', '2050-09-01', 'ACTIVE'),
  ('K005', 'C004', 'WORKING_CAPITAL', 80000.00, 0.22, '2024-10-01', '2026-10-01', 'ACTIVE'),
  ('K006', 'C005', 'WORKING_CAPITAL', 4500000.00, 0.135, '2023-02-01', '2028-02-01', 'ACTIVE'),
  ('K007', 'C006', 'PERSONAL_LOAN',  8000.00, 0.32,  '2023-05-01', '2025-05-01', 'WRITTEN_OFF'),  -- baixado
  ('K008', 'C007', 'AUTO_LOAN',     45000.00, 0.155, '2022-11-01', '2027-11-01', 'ACTIVE'),
  ('K009', 'C008', 'WORKING_CAPITAL', 60000.00, 0.21, '2025-01-01', '2026-01-01', 'ACTIVE'),
  ('K010', 'C001', 'CREDIT_CARD',    3000.00, 0.40, '2024-06-01', '2030-06-01', 'PAID_OFF');

-- Pagamentos. "Hoje" = 2025-12-01.
-- Casos propositais:
--   C002: 4 parcelas em aberto, 95+ dias atraso → INADIMPLENTE (AX-DEFAULT-90).
--   C004: 1 parcela 30 dias atrasada → ATRASADO mas NÃO inadimplente.
--   C006: contrato WRITTEN_OFF + conta fechada → NÃO ATIVO.
--   Restantes: em dia.

-- C001 — em dia
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0001','K001','2025-09-01','2025-09-01', 750.00, 750.00),
  ('P0002','K001','2025-10-01','2025-10-02', 750.00, 750.00),
  ('P0003','K001','2025-11-01','2025-11-01', 750.00, 750.00),
  ('P0004','K001','2025-12-01',  NULL,       750.00, NULL);

-- C002 — INADIMPLENTE: 4 parcelas em aberto, mais antiga vence 2025-08-15 (108 dias)
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0010','K002','2025-08-15', NULL, 600.00, NULL),
  ('P0011','K002','2025-09-15', NULL, 600.00, NULL),
  ('P0012','K002','2025-10-15', NULL, 600.00, NULL),
  ('P0013','K002','2025-11-15', NULL, 600.00, NULL),
  ('P0020','K003','2025-10-01', NULL, 250.00, NULL),
  ('P0021','K003','2025-11-01', NULL, 250.00, NULL);

-- C003 — em dia (mortgage gigante, parcelas pagas no dia)
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0030','K004','2025-10-01','2025-10-01', 5800.00, 5800.00),
  ('P0031','K004','2025-11-01','2025-11-01', 5800.00, 5800.00);

-- C004 — ATRASO de 30 dias (NÃO é inadimplente!) — caso clássico de ambiguidade
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0040','K005','2025-09-01','2025-09-01', 4500.00, 4500.00),
  ('P0041','K005','2025-10-01','2025-10-01', 4500.00, 4500.00),
  ('P0042','K005','2025-11-01', NULL,        4500.00, NULL),       -- 30 dias atrasado
  ('P0043','K005','2025-12-01', NULL,        4500.00, NULL);

-- C005 — corporate em dia
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0050','K006','2025-10-01','2025-10-01', 80000.00, 80000.00),
  ('P0051','K006','2025-11-01','2025-11-01', 80000.00, 80000.00);

-- C006 — contrato baixado, conta fechada (CHURN provável)
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0060','K007','2024-12-01', NULL, 350.00, NULL);  -- write-off antigo

-- C007 — em dia
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0070','K008','2025-10-01','2025-10-01', 980.00, 980.00),
  ('P0071','K008','2025-11-01','2025-11-01', 980.00, 980.00);

-- C008 — em dia, contrato novo
INSERT INTO payment (id, contract_id, due_date, paid_date, amount_due, amount_paid) VALUES
  ('P0080','K009','2025-11-01','2025-11-01', 5500.00, 5500.00);

-- Garantias
INSERT INTO collateral (id, contract_id, type, appraised_value) VALUES
  ('G001','K004','REAL_ESTATE',  900000.00),
  ('G002','K008','VEHICLE',       55000.00),
  ('G003','K006','GUARANTOR',   5000000.00);
