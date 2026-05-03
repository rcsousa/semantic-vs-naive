// ============================================================================
// Seed do Knowledge Graph. Espelha o Postgres porém otimizado para perguntas
// que envolvem TRAVERSAL: "quais clientes têm garantia em imóvel e estão
// em default?", "quem se relaciona com C002 via cobrança?", etc.
// ============================================================================

MATCH (n) DETACH DELETE n;

// Constraints
CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (k:CreditContract) REQUIRE k.id IS UNIQUE;
CREATE CONSTRAINT payment_id IF NOT EXISTS FOR (p:Payment) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT collateral_id IF NOT EXISTS FOR (g:Collateral) REQUIRE g.id IS UNIQUE;

// Customers
UNWIND [
  {id:'C001', name:'Ana Lima',          segment:'RETAIL',    onboarding_date:date('2018-03-12'), risk_rating:'B'},
  {id:'C002', name:'Bruno Souza',       segment:'RETAIL',    onboarding_date:date('2020-06-01'), risk_rating:'D'},
  {id:'C003', name:'Carla Mendes',      segment:'PRIVATE',   onboarding_date:date('2016-09-22'), risk_rating:'A'},
  {id:'C004', name:'Padaria Alvorada',  segment:'SME',       onboarding_date:date('2019-11-04'), risk_rating:'C'},
  {id:'C005', name:'Tech Holding S.A.', segment:'CORPORATE', onboarding_date:date('2014-01-15'), risk_rating:'AA'},
  {id:'C006', name:'Diego Pereira',     segment:'RETAIL',    onboarding_date:date('2022-02-08'), risk_rating:'E'},
  {id:'C007', name:'Elaine Costa',      segment:'RETAIL',    onboarding_date:date('2017-07-30'), risk_rating:'B'},
  {id:'C008', name:'Mercado Bom Preço', segment:'SME',       onboarding_date:date('2021-05-19'), risk_rating:'C'}
] AS c
MERGE (x:Customer {id:c.id})
SET x += c;

// Accounts
UNWIND [
  {id:'A001', customer_id:'C001', type:'CHECKING', opened_at:date('2018-03-12'), closed_at:null,                balance:3120.50},
  {id:'A002', customer_id:'C001', type:'SAVINGS',  opened_at:date('2019-01-10'), closed_at:null,                balance:15000.00},
  {id:'A003', customer_id:'C002', type:'CHECKING', opened_at:date('2020-06-01'), closed_at:null,                balance:120.00},
  {id:'A004', customer_id:'C003', type:'CHECKING', opened_at:date('2016-09-22'), closed_at:null,                balance:87000.00},
  {id:'A005', customer_id:'C004', type:'CHECKING', opened_at:date('2019-11-04'), closed_at:null,                balance:12000.00},
  {id:'A006', customer_id:'C005', type:'CHECKING', opened_at:date('2014-01-15'), closed_at:null,                balance:1500000.00},
  {id:'A007', customer_id:'C006', type:'CHECKING', opened_at:date('2022-02-08'), closed_at:date('2025-09-15'),  balance:0.00},
  {id:'A008', customer_id:'C007', type:'CHECKING', opened_at:date('2017-07-30'), closed_at:null,                balance:4200.00},
  {id:'A009', customer_id:'C008', type:'CHECKING', opened_at:date('2021-05-19'), closed_at:null,                balance:8500.00}
] AS a
MATCH (c:Customer {id:a.customer_id})
MERGE (x:Account {id:a.id})
SET x.type=a.type, x.opened_at=a.opened_at, x.closed_at=a.closed_at, x.balance=a.balance
MERGE (c)-[:OWNS]->(x);

// Contracts
UNWIND [
  {id:'K001', customer_id:'C001', product:'PERSONAL_LOAN',   principal:12000.00,   interest_rate_aa:0.18,  start_date:date('2024-08-01'), maturity_date:date('2026-08-01'), status:'ACTIVE'},
  {id:'K002', customer_id:'C002', product:'CREDIT_CARD',     principal:5000.00,    interest_rate_aa:0.42,  start_date:date('2023-04-01'), maturity_date:date('2030-04-01'), status:'ACTIVE'},
  {id:'K003', customer_id:'C002', product:'OVERDRAFT',       principal:2000.00,    interest_rate_aa:0.65,  start_date:date('2024-01-01'), maturity_date:date('2026-01-01'), status:'ACTIVE'},
  {id:'K004', customer_id:'C003', product:'MORTGAGE',        principal:650000.00,  interest_rate_aa:0.099, start_date:date('2020-09-01'), maturity_date:date('2050-09-01'), status:'ACTIVE'},
  {id:'K005', customer_id:'C004', product:'WORKING_CAPITAL', principal:80000.00,   interest_rate_aa:0.22,  start_date:date('2024-10-01'), maturity_date:date('2026-10-01'), status:'ACTIVE'},
  {id:'K006', customer_id:'C005', product:'WORKING_CAPITAL', principal:4500000.00, interest_rate_aa:0.135, start_date:date('2023-02-01'), maturity_date:date('2028-02-01'), status:'ACTIVE'},
  {id:'K007', customer_id:'C006', product:'PERSONAL_LOAN',   principal:8000.00,    interest_rate_aa:0.32,  start_date:date('2023-05-01'), maturity_date:date('2025-05-01'), status:'WRITTEN_OFF'},
  {id:'K008', customer_id:'C007', product:'AUTO_LOAN',       principal:45000.00,   interest_rate_aa:0.155, start_date:date('2022-11-01'), maturity_date:date('2027-11-01'), status:'ACTIVE'},
  {id:'K009', customer_id:'C008', product:'WORKING_CAPITAL', principal:60000.00,   interest_rate_aa:0.21,  start_date:date('2025-01-01'), maturity_date:date('2026-01-01'), status:'ACTIVE'},
  {id:'K010', customer_id:'C001', product:'CREDIT_CARD',     principal:3000.00,    interest_rate_aa:0.40,  start_date:date('2024-06-01'), maturity_date:date('2030-06-01'), status:'PAID_OFF'}
] AS k
MATCH (c:Customer {id:k.customer_id})
MERGE (x:CreditContract {id:k.id})
SET x.product=k.product, x.principal=k.principal, x.interest_rate_aa=k.interest_rate_aa,
    x.start_date=k.start_date, x.maturity_date=k.maturity_date, x.status=k.status
MERGE (c)-[:HOLDS]->(x);

// Payments (carrega CSV-like)
UNWIND [
  ['P0001','K001',date('2025-09-01'),date('2025-09-01'), 750.00,  750.00],
  ['P0002','K001',date('2025-10-01'),date('2025-10-02'), 750.00,  750.00],
  ['P0003','K001',date('2025-11-01'),date('2025-11-01'), 750.00,  750.00],
  ['P0004','K001',date('2025-12-01'), null,              750.00,  null],
  ['P0010','K002',date('2025-08-15'), null,              600.00,  null],
  ['P0011','K002',date('2025-09-15'), null,              600.00,  null],
  ['P0012','K002',date('2025-10-15'), null,              600.00,  null],
  ['P0013','K002',date('2025-11-15'), null,              600.00,  null],
  ['P0020','K003',date('2025-10-01'), null,              250.00,  null],
  ['P0021','K003',date('2025-11-01'), null,              250.00,  null],
  ['P0030','K004',date('2025-10-01'),date('2025-10-01'), 5800.00, 5800.00],
  ['P0031','K004',date('2025-11-01'),date('2025-11-01'), 5800.00, 5800.00],
  ['P0040','K005',date('2025-09-01'),date('2025-09-01'), 4500.00, 4500.00],
  ['P0041','K005',date('2025-10-01'),date('2025-10-01'), 4500.00, 4500.00],
  ['P0042','K005',date('2025-11-01'), null,              4500.00, null],
  ['P0043','K005',date('2025-12-01'), null,              4500.00, null],
  ['P0050','K006',date('2025-10-01'),date('2025-10-01'), 80000.00, 80000.00],
  ['P0051','K006',date('2025-11-01'),date('2025-11-01'), 80000.00, 80000.00],
  ['P0060','K007',date('2024-12-01'), null,              350.00,  null],
  ['P0070','K008',date('2025-10-01'),date('2025-10-01'), 980.00,  980.00],
  ['P0071','K008',date('2025-11-01'),date('2025-11-01'), 980.00,  980.00],
  ['P0080','K009',date('2025-11-01'),date('2025-11-01'), 5500.00, 5500.00]
] AS row
MATCH (k:CreditContract {id:row[1]})
MERGE (p:Payment {id:row[0]})
SET p.due_date=row[2], p.paid_date=row[3], p.amount_due=row[4], p.amount_paid=row[5]
MERGE (k)-[:HAS_PAYMENT]->(p);

// Collaterals
UNWIND [
  {id:'G001', contract_id:'K004', type:'REAL_ESTATE', appraised_value:900000.00},
  {id:'G002', contract_id:'K008', type:'VEHICLE',     appraised_value:55000.00},
  {id:'G003', contract_id:'K006', type:'GUARANTOR',   appraised_value:5000000.00}
] AS g
MATCH (k:CreditContract {id:g.contract_id})
MERGE (x:Collateral {id:g.id})
SET x.type=g.type, x.appraised_value=g.appraised_value
MERGE (k)-[:SECURED_BY]->(x);
