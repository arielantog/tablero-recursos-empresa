import { pathToFileURL } from "url";
import { pool } from "../config/db.js";

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateMonthsAgo(monthsAgo) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  return formatDate(date);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const BILLING_CATEGORY_DEFS = {
  PM: { multiplier: 1.08, roleHints: ["PM", "Product Owner"] },
  Developer: {
    multiplier: 1,
    roleHints: ["Backend", "Frontend", "Data Engineer", "Support"]
  },
  QA: { multiplier: 0.9, roleHints: ["QA"] },
  DevOps: { multiplier: 1.15, roleHints: ["DevOps"] },
  Data: { multiplier: 1.1, roleHints: ["Data Analyst", "Data Engineer"] },
  "UX/UI": { multiplier: 0.95, roleHints: ["UX/UI"] },
  "Product Owner": { multiplier: 1.12, roleHints: ["Product Owner", "PM"] },
  Support: { multiplier: 0.8, roleHints: ["Support"] }
};

function pickCategoriesForClient(clientId) {
  const mandatory = ["PM", "Developer", "QA"];
  const optional = ["DevOps", "Data", "UX/UI", "Product Owner", "Support"];

  const amount = 2 + (clientId % 3);
  const start = clientId % optional.length;
  const selected = [];

  for (let i = 0; i < amount; i += 1) {
    selected.push(optional[(start + i) % optional.length]);
  }

  return [...mandatory, ...selected];
}

function pickCategoryForPerson(categories, role) {
  const roleName = String(role || "").trim();
  const withHints = categories.filter((category) => {
    const def = BILLING_CATEGORY_DEFS[category.name];
    if (!def) return false;
    return def.roleHints.includes(roleName);
  });

  if (withHints.length) {
    return sample(withHints);
  }

  return categories[0] || null;
}

async function ensureClientsAndRates() {
  const clientSeeds = [
    { name: "Acme Corp", currency: "USD", baseRate: 42 },
    { name: "Pampa Tech", currency: "USD", baseRate: 55 },
    { name: "Delta Logistics", currency: "USD", baseRate: 48 },
    { name: "Orion Digital", currency: "USD", baseRate: 62 },
    { name: "Sur Energia", currency: "USD", baseRate: 58 },
    { name: "Andina Retail", currency: "ARS", baseRate: 14000 },
    { name: "Nexo Salud", currency: "ARS", baseRate: 16000 },
    { name: "Atlas Fintech", currency: "USD", baseRate: 68 },
    { name: "Horizonte Media", currency: "ARS", baseRate: 12000 },
    { name: "Brio Mobility", currency: "USD", baseRate: 51 }
  ];

  const clientRows = [];
  for (const seed of clientSeeds) {
    const result = await pool.query(
      "INSERT INTO clients(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name",
      [seed.name]
    );
    clientRows.push({
      id: result.rows[0].id,
      name: seed.name,
      currency: seed.currency,
      baseRate: seed.baseRate
    });
  }

  const historyMonths = [24, 18, 12, 6, 0];
  for (const client of clientRows) {
    for (let index = 0; index < historyMonths.length; index += 1) {
      const monthsAgo = historyMonths[index];
      const effectiveFrom = dateMonthsAgo(monthsAgo);
      const growthFactor = 1 + index * 0.08;
      const rate = Number((client.baseRate * growthFactor).toFixed(2));

      await pool.query(
        `INSERT INTO client_rates(client_id, currency, hourly_rate, effective_from)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(client_id, effective_from, currency)
         DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate`,
        [client.id, client.currency, rate, effectiveFrom]
      );
    }
  }

  return clientRows;
}

async function ensurePeople() {
  const peopleSeeds = [
    { fullName: "Ana Gomez", aliases: ["Ana Gomez", "Ana G\u00f3mez"], role: "Frontend", salary: 1800000 },
    {
      fullName: "Luciano Perez",
      aliases: ["Luciano Perez", "Luciano P\u00e9rez"],
      role: "Backend",
      salary: 2200000
    },
    {
      fullName: "Carla Mendez",
      aliases: ["Carla Mendez", "Carla M\u00e9ndez"],
      role: "Data Analyst",
      salary: 2000000
    },
    { fullName: "Jorge Diaz", aliases: ["Jorge Diaz", "Jorge D\u00edaz"], role: "PM", salary: 2600000 },
    { fullName: "Marina Torres", aliases: ["Marina Torres"], role: "QA", salary: 1300000 },
    { fullName: "Pablo Ruiz", aliases: ["Pablo Ruiz"], role: "Backend", salary: 2100000 },
    { fullName: "Sofia Vega", aliases: ["Sofia Vega"], role: "Frontend", salary: 1700000 },
    { fullName: "Diego Luna", aliases: ["Diego Luna"], role: "DevOps", salary: 2400000 },
    { fullName: "Camila Rios", aliases: ["Camila Rios"], role: "Data Analyst", salary: 1550000 },
    { fullName: "Nicolas Sosa", aliases: ["Nicolas Sosa"], role: "Backend", salary: 1950000 },
    { fullName: "Valentina Paz", aliases: ["Valentina Paz"], role: "QA", salary: 1250000 },
    { fullName: "Martin Farias", aliases: ["Martin Farias"], role: "PM", salary: 2500000 },
    { fullName: "Julieta Acosta", aliases: ["Julieta Acosta"], role: "UX/UI", salary: 1450000 },
    { fullName: "Ezequiel Romero", aliases: ["Ezequiel Romero"], role: "Backend", salary: 2050000 },
    {
      fullName: "Florencia Nunez",
      aliases: ["Florencia Nunez", "Florencia Nu\u00f1ez"],
      role: "Frontend",
      salary: 1650000
    },
    { fullName: "Tomas Silva", aliases: ["Tomas Silva"], role: "DevOps", salary: 2300000 },
    { fullName: "Agustina Bravo", aliases: ["Agustina Bravo"], role: "QA", salary: 1200000 },
    { fullName: "Federico Cano", aliases: ["Federico Cano"], role: "Data Engineer", salary: 2350000 },
    { fullName: "Lara Benitez", aliases: ["Lara Benitez"], role: "Product Owner", salary: 2450000 },
    { fullName: "Bruno Contreras", aliases: ["Bruno Contreras"], role: "Support", salary: 950000 }
  ];

  for (const person of peopleSeeds) {
    await pool.query(
      `INSERT INTO people(full_name, role, monthly_salary, salary_currency)
       SELECT $1::text, $2::text, $3::numeric, 'ARS'::text
       WHERE NOT EXISTS (
         SELECT 1
         FROM people
         WHERE full_name = ANY($4::text[])
       )`,
      [person.fullName, person.role, person.salary, person.aliases]
    );

    await pool.query(
      `UPDATE people
       SET role = $1,
           monthly_salary = $2,
           salary_currency = 'ARS'
       WHERE full_name = ANY($3::text[])`,
      [person.role, person.salary, person.aliases]
    );
  }

  await pool.query(
    `WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY lower(translate(full_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
          ORDER BY monthly_salary DESC, id DESC
        ) AS rn
      FROM people
    )
    UPDATE people p
    SET active = CASE WHEN ranked.rn = 1 THEN TRUE ELSE FALSE END
    FROM ranked
    WHERE p.id = ranked.id`
  );

  const result = await pool.query(
    `SELECT id, full_name, role
     FROM people
     WHERE active = TRUE
     ORDER BY id`
  );

  return result.rows;
}

async function ensureClientBillingCategories(clients) {
  await pool.query("DELETE FROM client_rate_rules");
  await pool.query("DELETE FROM client_billing_categories");

  const categoriesByClientId = new Map();
  for (const client of clients) {
    const categoryNames = pickCategoriesForClient(Number(client.id));
    const rows = [];

    for (const categoryName of categoryNames) {
      const result = await pool.query(
        `INSERT INTO client_billing_categories(client_id, name, active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT(client_id, name)
         DO UPDATE SET active = TRUE
         RETURNING id, client_id, name`,
        [client.id, categoryName]
      );
      rows.push(result.rows[0]);
    }

    categoriesByClientId.set(Number(client.id), rows);
  }

  return categoriesByClientId;
}

async function ensureClientRateRules(clients, categoriesByClientId, people) {
  const effectiveDates = [dateMonthsAgo(6), dateMonthsAgo(0)];
  const clientRates = await pool.query(
    `SELECT client_id, effective_from::text AS effective_from, currency, hourly_rate
     FROM client_rates
     WHERE effective_from = ANY($1::date[])`,
    [effectiveDates]
  );

  const clientRateMap = new Map();
  for (const rate of clientRates.rows) {
    clientRateMap.set(`${rate.client_id}|${rate.effective_from}`, {
      currency: rate.currency,
      hourlyRate: Number(rate.hourly_rate)
    });
  }

  for (const client of clients) {
    const categories = categoriesByClientId.get(Number(client.id)) || [];

    for (const effectiveFrom of effectiveDates) {
      const base = clientRateMap.get(`${client.id}|${effectiveFrom}`);
      if (!base) continue;

      for (const category of categories) {
        const def = BILLING_CATEGORY_DEFS[category.name] || { multiplier: 1 };
        const recencyFactor = effectiveFrom === effectiveDates[1] ? 1.04 : 1;
        const hourlyRate = Number((base.hourlyRate * def.multiplier * recencyFactor).toFixed(2));

        await pool.query(
          `INSERT INTO client_rate_rules(
            client_id,
            billing_category_id,
            person_id,
            currency,
            hourly_rate,
            effective_from
          ) VALUES ($1, $2, NULL, $3, $4, $5)`,
          [client.id, category.id, base.currency, hourlyRate, effectiveFrom]
        );
      }
    }
  }

  const peopleByName = new Map(people.map((person) => [normalizeName(person.full_name), person]));
  const currentDate = effectiveDates[1];

  const acmeClient = clients.find((client) => client.name === "Acme Corp");
  if (acmeClient) {
    const categories = categoriesByClientId.get(Number(acmeClient.id)) || [];
    const pmCategory = categories.find((item) => item.name === "PM");
    const devCategory = categories.find((item) => item.name === "Developer");

    if (pmCategory) {
      await pool.query(
        `INSERT INTO client_rate_rules(
          client_id, billing_category_id, person_id, currency, hourly_rate, effective_from
        ) VALUES ($1, $2, NULL, 'USD', 54.00, $3)`,
        [acmeClient.id, pmCategory.id, currentDate]
      );
    }

    if (devCategory) {
      await pool.query(
        `INSERT INTO client_rate_rules(
          client_id, billing_category_id, person_id, currency, hourly_rate, effective_from
        ) VALUES ($1, $2, NULL, 'USD', 50.00, $3)`,
        [acmeClient.id, devCategory.id, currentDate]
      );
    }
  }

  const atlasClient = clients.find((client) => client.name === "Atlas Fintech");
  if (atlasClient) {
    const jorge = peopleByName.get(normalizeName("Jorge Diaz"));
    const martin = peopleByName.get(normalizeName("Martin Farias"));

    if (jorge) {
      await pool.query(
        `INSERT INTO client_rate_rules(
          client_id, billing_category_id, person_id, currency, hourly_rate, effective_from
        ) VALUES ($1, NULL, $2, 'USD', 89.76, $3)`,
        [atlasClient.id, jorge.id, currentDate]
      );
    }

    if (martin) {
      await pool.query(
        `INSERT INTO client_rate_rules(
          client_id, billing_category_id, person_id, currency, hourly_rate, effective_from
        ) VALUES ($1, NULL, $2, 'USD', 45.00, $3)`,
        [atlasClient.id, martin.id, currentDate]
      );
    }
  }
}

function getBusinessDates(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function insertTimeEntryBatch(entries) {
  if (!entries.length) return;

  const values = [];
  const placeholders = entries.map((entry, index) => {
    const offset = index * 5;
    values.push(entry.personId, entry.clientId, entry.billingCategoryId, entry.workDate, entry.hours);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
  });

  await pool.query(
    `INSERT INTO time_entries(person_id, client_id, billing_category_id, work_date, hours)
     VALUES ${placeholders.join(",")}`,
    values
  );
}

async function generateTimeEntries(clients, people, categoriesByClientId) {
  if (!clients.length || !people.length) {
    return;
  }

  const startDate = dateMonthsAgo(6);
  const endDate = formatDate(new Date());
  const businessDates = getBusinessDates(startDate, endDate);

  await pool.query("DELETE FROM time_entries WHERE work_date BETWEEN $1 AND $2", [startDate, endDate]);

  const entries = [];
  for (const workDate of businessDates) {
    for (const person of people) {
      if (Math.random() > 0.8) continue;
      const hours = Number(randomBetween(7.4, 8.6).toFixed(2));
      const client = sample(clients);
      const clientCategories = categoriesByClientId.get(Number(client.id)) || [];
      const pickedCategory = pickCategoryForPerson(clientCategories, person.role);

      entries.push({
        personId: person.id,
        clientId: client.id,
        billingCategoryId: pickedCategory ? pickedCategory.id : null,
        workDate,
        hours
      });
    }
  }

  const chunkSize = 300;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    await insertTimeEntryBatch(chunk);
  }
}

export default async function seed() {
  const clients = await ensureClientsAndRates();
  const people = await ensurePeople();
  const categoriesByClientId = await ensureClientBillingCategories(clients);
  await ensureClientRateRules(clients, categoriesByClientId, people);
  await generateTimeEntries(clients, people, categoriesByClientId);
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  seed()
    .then(() => {
      console.log("Datos dummy insertados correctamente.");
    })
    .catch((err) => {
      console.error("Error insertando seed:", err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
