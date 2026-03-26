import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'time_entries'
       ) THEN
         ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS client_id INTEGER;
         ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS billing_category_id INTEGER;
       END IF;
     END
     $$`
  );

  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);

  await pool.query("ALTER TABLE people ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) DEFAULT 0");
  await pool.query(
    "ALTER TABLE people ADD COLUMN IF NOT EXISTS salary_currency TEXT NOT NULL DEFAULT 'ARS'"
  );
  await pool.query(
    `UPDATE people
     SET salary_currency = 'ARS'
     WHERE salary_currency IS NULL OR salary_currency = ''`
  );

  await pool.query("ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS fk_time_entries_billing_category");
  await pool.query("ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_billing_category_id_fkey");
  await pool.query("ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_project_id_fkey");
  await pool.query("ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS fk_time_entries_client");

  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'projects'
       ) AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'time_entries'
           AND column_name = 'project_id'
       ) THEN
         UPDATE time_entries te
         SET client_id = p.client_id
         FROM projects p
         WHERE te.project_id = p.id
           AND te.client_id IS NULL;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'project_billing_categories'
       ) AND EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'projects'
       ) THEN
         INSERT INTO client_billing_categories(client_id, name, active)
         SELECT
           p.client_id,
           pbc.name,
           BOOL_OR(COALESCE(pbc.active, TRUE)) AS active
         FROM project_billing_categories pbc
         JOIN projects p ON p.id = pbc.project_id
         GROUP BY p.client_id, pbc.name
         ON CONFLICT(client_id, name)
         DO UPDATE SET active = EXCLUDED.active;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'project_billing_categories'
       ) AND EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'projects'
       ) THEN
         UPDATE time_entries te
         SET billing_category_id = cbc.id
         FROM project_billing_categories pbc
         JOIN projects p ON p.id = pbc.project_id
         JOIN client_billing_categories cbc
           ON cbc.client_id = p.client_id
          AND cbc.name = pbc.name
         WHERE te.billing_category_id = pbc.id;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'project_rate_rules'
       ) AND EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'projects'
       ) THEN
         INSERT INTO client_rate_rules(
           client_id,
           billing_category_id,
           person_id,
           currency,
           hourly_rate,
           effective_from
         )
         SELECT
           p.client_id,
           cbc.id,
           prr.person_id,
           prr.currency,
           prr.hourly_rate,
           prr.effective_from
         FROM project_rate_rules prr
         JOIN projects p
           ON p.id = prr.project_id
         LEFT JOIN project_billing_categories pbc
           ON pbc.id = prr.billing_category_id
         LEFT JOIN client_billing_categories cbc
           ON cbc.client_id = p.client_id
          AND cbc.name = pbc.name
         LEFT JOIN client_rate_rules existing
           ON existing.client_id = p.client_id
          AND existing.person_id IS NOT DISTINCT FROM prr.person_id
          AND existing.billing_category_id IS NOT DISTINCT FROM cbc.id
          AND existing.currency = prr.currency
          AND existing.hourly_rate = prr.hourly_rate
          AND existing.effective_from = prr.effective_from
         WHERE existing.id IS NULL;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     DECLARE
       fk_name TEXT;
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'time_entries'
       ) THEN
         FOR fk_name IN
           SELECT conname
           FROM pg_constraint
           WHERE conrelid = 'time_entries'::regclass
             AND contype = 'f'
         LOOP
           IF fk_name IN (
             'time_entries_project_id_fkey',
             'time_entries_billing_category_id_fkey',
             'fk_time_entries_billing_category',
             'fk_time_entries_client'
           ) THEN
             EXECUTE format('ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS %I', fk_name);
           END IF;
         END LOOP;
       END IF;
     END
     $$`
  );

  await pool.query(
    `UPDATE time_entries te
     SET billing_category_id = NULL
     WHERE te.billing_category_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM client_billing_categories cbc
         WHERE cbc.id = te.billing_category_id
       )`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'fk_time_entries_client'
       ) THEN
         ALTER TABLE time_entries
         ADD CONSTRAINT fk_time_entries_client
         FOREIGN KEY (client_id)
         REFERENCES clients(id)
         ON DELETE RESTRICT;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'fk_time_entries_billing_category'
       ) THEN
         ALTER TABLE time_entries
         ADD CONSTRAINT fk_time_entries_billing_category
         FOREIGN KEY (billing_category_id)
         REFERENCES client_billing_categories(id)
         ON DELETE SET NULL;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'time_entries'
           AND column_name = 'project_id'
       ) THEN
         ALTER TABLE time_entries DROP COLUMN project_id;
       END IF;
     END
     $$`
  );

  await pool.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM time_entries WHERE client_id IS NULL) THEN
         ALTER TABLE time_entries ALTER COLUMN client_id SET NOT NULL;
       END IF;
     END
     $$`
  );

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_time_entries_client_person_date
     ON time_entries(client_id, person_id, work_date)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_time_entries_category
     ON time_entries(billing_category_id)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_client_billing_categories_client
     ON client_billing_categories(client_id, active)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_client_rate_rules_lookup
     ON client_rate_rules(client_id, person_id, billing_category_id, effective_from DESC)`
  );

  await pool.query("DROP INDEX IF EXISTS idx_time_entries_project_person_date");
  await pool.query("DROP INDEX IF EXISTS idx_project_billing_categories_project");
  await pool.query("DROP INDEX IF EXISTS idx_project_rate_rules_lookup");

  await pool.query("DROP TABLE IF EXISTS project_rate_rules CASCADE");
  await pool.query("DROP TABLE IF EXISTS project_billing_categories CASCADE");
  await pool.query("DROP TABLE IF EXISTS projects CASCADE");

  console.log("Base de datos inicializada correctamente (modelo por cliente).");
}

initDb()
  .catch((err) => {
    console.error("Error inicializando la base:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
