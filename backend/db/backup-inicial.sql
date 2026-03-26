-- Snapshot inicial de datos
-- Generado: 2026-03-11T23:15:04.563Z
BEGIN;

TRUNCATE TABLE
  time_entries,
  client_rate_rules,
  client_billing_categories,
  client_rates,
  people,
  clients,
  exchange_rates
RESTART IDENTITY CASCADE;

INSERT INTO clients (id, name, created_at, active) VALUES (1, 'Ascend Partners', '2026-03-12T01:55:32.322Z', TRUE);
INSERT INTO clients (id, name, created_at, active) VALUES (2, 'Grupo Cavallaro', '2026-03-12T02:01:59.013Z', TRUE);

INSERT INTO people (id, full_name, role, monthly_salary, salary_currency, active, created_at) VALUES (2, 'Ariel Antognini', NULL, '2000000.00', 'ARS', TRUE, '2026-03-12T01:56:02.657Z');
INSERT INTO people (id, full_name, role, monthly_salary, salary_currency, active, created_at) VALUES (3, 'Nicolas Sueldo', NULL, '1800000.00', 'ARS', TRUE, '2026-03-12T02:02:42.107Z');

-- client_rates: sin filas

INSERT INTO client_billing_categories (id, client_id, name, created_at, active) VALUES (1, 2, 'PM', '2026-03-12T02:02:54.179Z', TRUE);
INSERT INTO client_billing_categories (id, client_id, name, created_at, active) VALUES (2, 2, 'Developer', '2026-03-12T02:03:01.891Z', TRUE);
INSERT INTO client_billing_categories (id, client_id, name, created_at, active) VALUES (3, 2, 'Funcional', '2026-03-12T02:03:05.527Z', TRUE);

INSERT INTO client_rate_rules (id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from, created_at) VALUES (1, 1, NULL, 2, 'USD', '15.00', '2018-01-01T03:00:00.000Z', '2026-03-12T01:56:46.523Z');
INSERT INTO client_rate_rules (id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from, created_at) VALUES (2, 1, NULL, 2, 'USD', '21.00', '2026-01-01T03:00:00.000Z', '2026-03-12T01:57:33.985Z');
INSERT INTO client_rate_rules (id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from, created_at) VALUES (3, 2, 2, NULL, 'USD', '15.00', '2026-01-01T03:00:00.000Z', '2026-03-12T02:03:39.391Z');
INSERT INTO client_rate_rules (id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from, created_at) VALUES (5, 2, 1, NULL, 'USD', '20.00', '2026-01-01T03:00:00.000Z', '2026-03-12T02:05:23.477Z');

INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (1, 2, 1, NULL, '2026-02-02T03:00:00.000Z', '20.00', '2026-03-12T01:58:50.662Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (2, 2, 1, NULL, '2026-02-09T03:00:00.000Z', '20.00', '2026-03-12T01:59:39.884Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (3, 2, 1, NULL, '2026-02-16T03:00:00.000Z', '20.00', '2026-03-12T01:59:44.529Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (4, 2, 1, NULL, '2026-02-23T03:00:00.000Z', '20.00', '2026-03-12T01:59:50.180Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (5, 2, 1, NULL, '2026-02-03T03:00:00.000Z', '20.00', '2026-03-12T02:00:43.736Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (6, 2, 1, NULL, '2026-02-10T03:00:00.000Z', '20.00', '2026-03-12T02:00:47.391Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (7, 2, 1, NULL, '2026-02-17T03:00:00.000Z', '20.00', '2026-03-12T02:00:50.968Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (8, 2, 1, NULL, '2026-02-24T03:00:00.000Z', '20.00', '2026-03-12T02:00:56.734Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (9, 3, 2, 1, '2026-02-01T03:00:00.000Z', '20.00', '2026-03-12T02:04:29.590Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (10, 3, 2, 1, '2026-02-09T03:00:00.000Z', '20.00', '2026-03-12T02:04:42.993Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (11, 3, 2, 1, '2026-02-09T03:00:00.000Z', '20.00', '2026-03-12T02:05:40.960Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (12, 3, 2, 1, '2026-02-10T03:00:00.000Z', '20.00', '2026-03-12T02:05:44.798Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (13, 3, 2, 1, '2026-02-16T03:00:00.000Z', '20.00', '2026-03-12T02:05:49.764Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (14, 3, 2, 1, '2026-02-17T03:00:00.000Z', '20.00', '2026-03-12T02:05:52.966Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (15, 3, 2, 1, '2026-02-23T03:00:00.000Z', '20.00', '2026-03-12T02:05:55.774Z');
INSERT INTO time_entries (id, person_id, client_id, billing_category_id, work_date, hours, created_at) VALUES (16, 3, 2, 1, '2026-02-24T03:00:00.000Z', '20.00', '2026-03-12T02:05:58.962Z');

INSERT INTO exchange_rates (id, base_currency, quote_currency, rate_date, rate, source, created_at, updated_at) VALUES (1, 'USD', 'ARS', '2026-03-11T03:00:00.000Z', '1396.00000000', 'bcra', '2026-03-12T01:55:11.393Z', '2026-03-12T01:55:11.393Z');
INSERT INTO exchange_rates (id, base_currency, quote_currency, rate_date, rate, source, created_at, updated_at) VALUES (2, 'USD', 'ARS', '2026-02-28T03:00:00.000Z', '1397.00000000', 'bcra', '2026-03-12T01:59:09.743Z', '2026-03-12T01:59:09.743Z');
INSERT INTO exchange_rates (id, base_currency, quote_currency, rate_date, rate, source, created_at, updated_at) VALUES (3, 'EUR', 'USD', '2026-03-11T03:00:00.000Z', '1.15810000', 'frankfurter', '2026-03-12T02:14:04.949Z', '2026-03-12T02:14:04.949Z');

SELECT setval(pg_get_serial_sequence('clients', 'id'), COALESCE((SELECT MAX(id) FROM clients), 1), (SELECT COUNT(*) > 0 FROM clients));
SELECT setval(pg_get_serial_sequence('people', 'id'), COALESCE((SELECT MAX(id) FROM people), 1), (SELECT COUNT(*) > 0 FROM people));
SELECT setval(pg_get_serial_sequence('client_rates', 'id'), COALESCE((SELECT MAX(id) FROM client_rates), 1), (SELECT COUNT(*) > 0 FROM client_rates));
SELECT setval(pg_get_serial_sequence('client_billing_categories', 'id'), COALESCE((SELECT MAX(id) FROM client_billing_categories), 1), (SELECT COUNT(*) > 0 FROM client_billing_categories));
SELECT setval(pg_get_serial_sequence('client_rate_rules', 'id'), COALESCE((SELECT MAX(id) FROM client_rate_rules), 1), (SELECT COUNT(*) > 0 FROM client_rate_rules));
SELECT setval(pg_get_serial_sequence('time_entries', 'id'), COALESCE((SELECT MAX(id) FROM time_entries), 1), (SELECT COUNT(*) > 0 FROM time_entries));
SELECT setval(pg_get_serial_sequence('exchange_rates', 'id'), COALESCE((SELECT MAX(id) FROM exchange_rates), 1), (SELECT COUNT(*) > 0 FROM exchange_rates));

COMMIT;
