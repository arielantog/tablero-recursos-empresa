CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS client_rates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'ARS')),
  hourly_rate NUMERIC(12,2) NOT NULL CHECK (hourly_rate > 0),
  effective_from DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, effective_from, currency)
);

CREATE TABLE IF NOT EXISTS client_billing_categories (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(client_id, name)
);

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT,
  monthly_salary NUMERIC(12,2) DEFAULT 0,
  salary_currency TEXT NOT NULL DEFAULT 'ARS',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_rate_rules (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  billing_category_id INTEGER REFERENCES client_billing_categories(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'ARS')),
  hourly_rate NUMERIC(12,2) NOT NULL CHECK (hourly_rate > 0),
  effective_from DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  billing_category_id INTEGER REFERENCES client_billing_categories(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(base_currency, quote_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_client_rates_client_date
  ON client_rates(client_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_work_date
  ON time_entries(work_date);

CREATE INDEX IF NOT EXISTS idx_time_entries_client_person_date
  ON time_entries(client_id, person_id, work_date);

CREATE INDEX IF NOT EXISTS idx_time_entries_category
  ON time_entries(billing_category_id);

CREATE INDEX IF NOT EXISTS idx_client_billing_categories_client
  ON client_billing_categories(client_id, active);

CREATE INDEX IF NOT EXISTS idx_client_rate_rules_lookup
  ON client_rate_rules(client_id, person_id, billing_category_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date
  ON exchange_rates(base_currency, quote_currency, rate_date DESC);
