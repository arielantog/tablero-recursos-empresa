import { Router } from "express";
import { pool } from "../config/db.js";
import { getEmployeeMetrics } from "../services/metrics.service.js";
import { getExchangeRate } from "../services/exchange-rate.service.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/clients", async (_req, res, next) => {
  try {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
      .toISOString()
      .slice(0, 10);
    const from = defaultFrom;
    const to = today.toISOString().slice(0, 10);

    const result = await pool.query(
      `SELECT
        c.id,
        c.name,
        c.active,
        EXISTS (
          SELECT 1
          FROM time_entries te
          WHERE te.client_id = c.id
        ) AS has_time_entries,
        latest.id AS rate_id,
        latest.currency,
        latest.hourly_rate,
        latest.effective_from,
        COALESCE(history.rates_history, '[]'::json) AS rates_history
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT id, currency, hourly_rate, effective_from
        FROM client_rates
        WHERE client_id = c.id
        ORDER BY effective_from DESC
        LIMIT 1
      ) latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', x.id,
            'currency', x.currency,
            'hourly_rate', x.hourly_rate,
            'effective_from', x.effective_from
          )
          ORDER BY x.effective_from DESC
        ) AS rates_history
        FROM (
          SELECT id, currency, hourly_rate, effective_from
          FROM client_rates
          WHERE client_id = c.id
            AND effective_from BETWEEN $1 AND $2
          ORDER BY effective_from DESC
          LIMIT 5
        ) x
      ) history ON TRUE
      WHERE c.active = TRUE
      ORDER BY c.name`,
      [from, to]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/clients", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "El nombre del cliente es obligatorio." });
    }

    const result = await pool.query(
      `INSERT INTO clients(name, active)
       VALUES ($1, TRUE)
       ON CONFLICT(name)
       DO UPDATE SET active = TRUE
       RETURNING id, name, active`,
      [name]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.patch("/clients/:clientId", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const name = String(req.body?.name || "").trim();

    if (!clientId || !name) {
      return res.status(400).json({ message: "Cliente y nombre son obligatorios." });
    }

    const result = await pool.query(
      `UPDATE clients
       SET name = $1
       WHERE id = $2
         AND active = TRUE
       RETURNING id, name, active`,
      [name, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un cliente con ese nombre." });
    }
    return next(error);
  }
});

router.delete("/clients/:clientId", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!clientId) {
      return res.status(400).json({ message: "Cliente invalido." });
    }

    const usage = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM time_entries te
       WHERE te.client_id = $1`,
      [clientId]
    );

    if (Number(usage.rows[0]?.total || 0) > 0) {
      return res.status(409).json({
        message: "No se puede eliminar el cliente porque tiene horas cargadas."
      });
    }

    const result = await pool.query(
      `DELETE FROM clients
       WHERE id = $1
       RETURNING id`,
      [clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/clients/:clientId/billing-categories", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!clientId) {
      return res.status(400).json({ message: "Cliente invalido." });
    }

    const result = await pool.query(
      `SELECT id, client_id, name, active
       FROM client_billing_categories
       WHERE client_id = $1
         AND active = TRUE
       ORDER BY name`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/clients/:clientId/billing-categories", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const name = String(req.body?.name || "").trim();

    if (!clientId || !name) {
      return res.status(400).json({ message: "Cliente y nombre de categoria son obligatorios." });
    }

    const result = await pool.query(
      `INSERT INTO client_billing_categories(client_id, name, active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT(client_id, name)
       DO UPDATE SET active = TRUE
       RETURNING id, client_id, name, active`,
      [clientId, name]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/clients/:clientId/billing-categories/:categoryId", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const categoryId = Number(req.params.categoryId);

    if (!clientId || !categoryId) {
      return res.status(400).json({ message: "Cliente o categoria invalidos." });
    }

    const result = await pool.query(
      `DELETE FROM client_billing_categories
       WHERE id = $1
         AND client_id = $2
       RETURNING id`,
      [categoryId, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Categoria no encontrada para el cliente indicado." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/clients/:clientId/rate-rules", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!clientId) {
      return res.status(400).json({ message: "Cliente invalido." });
    }

    const result = await pool.query(
      `SELECT
        crr.id,
        crr.client_id,
        crr.billing_category_id,
        cat.name AS billing_category_name,
        crr.person_id,
        pe.full_name AS person_name,
        crr.currency,
        crr.hourly_rate,
        crr.effective_from
      FROM client_rate_rules crr
      LEFT JOIN client_billing_categories cat ON cat.id = crr.billing_category_id
      LEFT JOIN people pe ON pe.id = crr.person_id
      WHERE crr.client_id = $1
      ORDER BY crr.effective_from DESC, crr.id DESC`,
      [clientId]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/clients/:clientId/rate-rules", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const billingCategoryIdRaw = req.body?.billingCategoryId;
    const personIdRaw = req.body?.personId;
    const currency = String(req.body?.currency || "").toUpperCase();
    const hourlyRate = Number(req.body?.hourlyRate);
    const effectiveFrom = req.body?.effectiveFrom;

    const billingCategoryId =
      billingCategoryIdRaw === undefined || billingCategoryIdRaw === null || billingCategoryIdRaw === ""
        ? null
        : Number(billingCategoryIdRaw);
    const personId =
      personIdRaw === undefined || personIdRaw === null || personIdRaw === ""
        ? null
        : Number(personIdRaw);

    if (!clientId || !currency || !hourlyRate || !effectiveFrom) {
      return res.status(400).json({ message: "Faltan datos para crear la regla de tarifa." });
    }

    if (!["USD", "ARS"].includes(currency)) {
      return res.status(400).json({ message: "Moneda invalida. Solo se permite USD o ARS." });
    }

    if (!billingCategoryId && !personId) {
      return res.status(400).json({
        message: "Si no definis categoria ni persona, carga la tarifa desde clientes."
      });
    }

    if (billingCategoryId) {
      const categoryValidation = await pool.query(
        `SELECT id
         FROM client_billing_categories
         WHERE id = $1
           AND client_id = $2
           AND active = TRUE`,
        [billingCategoryId, clientId]
      );
      if (!categoryValidation.rows.length) {
        return res.status(400).json({ message: "La categoria no pertenece al cliente indicado." });
      }
    }

    if (personId) {
      const personValidation = await pool.query(
        `SELECT id
         FROM people
         WHERE id = $1
           AND active = TRUE`,
        [personId]
      );
      if (!personValidation.rows.length) {
        return res.status(400).json({ message: "La persona indicada no existe o no esta activa." });
      }
    }

    const result = await pool.query(
      `INSERT INTO client_rate_rules(
        client_id,
        billing_category_id,
        person_id,
        currency,
        hourly_rate,
        effective_from
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from`,
      [clientId, billingCategoryId, personId, currency, hourlyRate, effectiveFrom]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.patch("/clients/:clientId/rate-rules/:ruleId", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const ruleId = Number(req.params.ruleId);

    if (!clientId || !ruleId) {
      return res.status(400).json({ message: "Cliente o regla invalidos." });
    }

    const payload = req.body || {};
    const hasCurrency = payload.currency !== undefined && payload.currency !== null && payload.currency !== "";
    const hasHourlyRate =
      payload.hourlyRate !== undefined && payload.hourlyRate !== null && payload.hourlyRate !== "";
    const hasEffectiveFrom =
      payload.effectiveFrom !== undefined && payload.effectiveFrom !== null && payload.effectiveFrom !== "";

    if (!hasCurrency && !hasHourlyRate && !hasEffectiveFrom) {
      return res.status(400).json({ message: "No se recibieron campos para actualizar." });
    }

    const currency = hasCurrency ? String(payload.currency).toUpperCase() : null;
    const hourlyRate = hasHourlyRate ? Number(payload.hourlyRate) : null;
    const effectiveFrom = hasEffectiveFrom ? String(payload.effectiveFrom) : null;

    if (hasCurrency && !["USD", "ARS"].includes(currency)) {
      return res.status(400).json({ message: "Moneda invalida. Solo se permite USD o ARS." });
    }

    if (hasHourlyRate && (!Number.isFinite(hourlyRate) || hourlyRate <= 0)) {
      return res.status(400).json({ message: "El valor hora debe ser mayor a 0." });
    }

    const result = await pool.query(
      `UPDATE client_rate_rules
       SET currency = COALESCE($1, currency),
           hourly_rate = COALESCE($2, hourly_rate),
           effective_from = COALESCE($3, effective_from)
       WHERE id = $4
         AND client_id = $5
       RETURNING id, client_id, billing_category_id, person_id, currency, hourly_rate, effective_from`,
      [currency, hourlyRate, effectiveFrom, ruleId, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Regla no encontrada para el cliente indicado." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/clients/:clientId/rate-rules/:ruleId", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const ruleId = Number(req.params.ruleId);

    if (!clientId || !ruleId) {
      return res.status(400).json({ message: "Cliente o regla invalidos." });
    }

    const result = await pool.query(
      `DELETE FROM client_rate_rules
       WHERE id = $1
         AND client_id = $2
       RETURNING id`,
      [ruleId, clientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Regla no encontrada para el cliente indicado." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/clients/:clientId/rates", async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    const { currency, hourlyRate, effectiveFrom } = req.body;

    if (!clientId || !currency || !hourlyRate || !effectiveFrom) {
      return res.status(400).json({ message: "Faltan datos de tarifa." });
    }

    const result = await pool.query(
      `INSERT INTO client_rates(client_id, currency, hourly_rate, effective_from)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(client_id, effective_from, currency)
       DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate
       RETURNING id, client_id, currency, hourly_rate, effective_from`,
      [clientId, String(currency).toUpperCase(), Number(hourlyRate), effectiveFrom]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.patch("/client-rates/:rateId", async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId);
    const { hourlyRate } = req.body;

    if (!rateId || hourlyRate === undefined || hourlyRate === null) {
      return res.status(400).json({ message: "Faltan datos para editar tarifa." });
    }

    const result = await pool.query(
      `UPDATE client_rates
       SET hourly_rate = $1
       WHERE id = $2
       RETURNING id, client_id, currency, hourly_rate, effective_from`,
      [Number(hourlyRate), rateId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Tarifa no encontrada." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/client-rates/:rateId", async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId);
    if (!rateId) {
      return res.status(400).json({ message: "Tarifa invalida." });
    }

    const result = await pool.query("DELETE FROM client_rates WHERE id = $1 RETURNING id", [rateId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: "Tarifa no encontrada." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/people", async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const monthlySalary = Number(req.body?.monthlySalary);

    if (!fullName) {
      return res.status(400).json({ message: "El nombre de la persona es obligatorio." });
    }
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      return res.status(400).json({ message: "El sueldo mensual debe ser mayor o igual a 0." });
    }

    const existing = await pool.query(
      `SELECT id
       FROM people
       WHERE lower(full_name) = lower($1)
         AND active = TRUE
       LIMIT 1`,
      [fullName]
    );

    if (existing.rows.length) {
      return res.status(409).json({ message: "Ya existe una persona activa con ese nombre." });
    }

    const result = await pool.query(
      `INSERT INTO people(full_name, role, monthly_salary, salary_currency, active)
       VALUES ($1, NULL, $2, 'ARS', TRUE)
       RETURNING id, full_name, monthly_salary, salary_currency`,
      [fullName, monthlySalary]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.patch("/people/:personId", async (req, res, next) => {
  try {
    const personId = Number(req.params.personId);
    const fullName = String(req.body?.fullName || "").trim();
    const monthlySalary = Number(req.body?.monthlySalary);

    if (!personId || !fullName) {
      return res.status(400).json({ message: "Persona y nombre son obligatorios." });
    }
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      return res.status(400).json({ message: "El sueldo mensual debe ser mayor o igual a 0." });
    }

    const existing = await pool.query(
      `SELECT id
       FROM people
       WHERE lower(full_name) = lower($1)
         AND id <> $2
         AND active = TRUE
       LIMIT 1`,
      [fullName, personId]
    );

    if (existing.rows.length) {
      return res.status(409).json({ message: "Ya existe otra persona activa con ese nombre." });
    }

    const result = await pool.query(
      `UPDATE people
       SET full_name = $1,
           monthly_salary = $2
       WHERE id = $3
         AND active = TRUE
       RETURNING id, full_name, monthly_salary, salary_currency`,
      [fullName, monthlySalary, personId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Persona no encontrada." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete("/people/:personId", async (req, res, next) => {
  try {
    const personId = Number(req.params.personId);
    if (!personId) {
      return res.status(400).json({ message: "Persona invalida." });
    }

    const result = await pool.query(
      `DELETE FROM people
       WHERE id = $1
         AND active = TRUE
       RETURNING id`,
      [personId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Persona no encontrada." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/people", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        full_name,
        COALESCE(monthly_salary, 0) AS monthly_salary,
        COALESCE(salary_currency, 'ARS') AS salary_currency
      FROM people
      WHERE active = TRUE
      ORDER BY full_name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/time-entries", async (req, res, next) => {
  try {
    const { personId, clientId, workDate, hours, billingCategoryId } = req.body;

    if (!personId || !clientId || !workDate || !hours) {
      return res.status(400).json({ message: "Datos de horas incompletos." });
    }

    let normalizedCategoryId = null;
    if (billingCategoryId !== undefined && billingCategoryId !== null && billingCategoryId !== "") {
      normalizedCategoryId = Number(billingCategoryId);
      if (!normalizedCategoryId) {
        return res.status(400).json({ message: "Categoria de facturacion invalida." });
      }

      const categoryValidation = await pool.query(
        `SELECT id
         FROM client_billing_categories
         WHERE id = $1
           AND client_id = $2
           AND active = TRUE`,
        [normalizedCategoryId, Number(clientId)]
      );

      if (!categoryValidation.rows.length) {
        return res.status(400).json({ message: "La categoria no pertenece al cliente seleccionado." });
      }
    }

    const result = await pool.query(
      `INSERT INTO time_entries(person_id, client_id, billing_category_id, work_date, hours)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, person_id, client_id, billing_category_id, work_date, hours`,
      [Number(personId), Number(clientId), normalizedCategoryId, workDate, Number(hours)]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.get("/metrics/employees", async (req, res, next) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || new Date().toISOString().slice(0, 10);

    const metrics = await getEmployeeMetrics(from, to);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/metrics/overview", async (req, res, next) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || new Date().toISOString().slice(0, 10);

    const metrics = await getEmployeeMetrics(from, to);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/exchange-rates", async (req, res, next) => {
  try {
    const baseCurrency = String(req.query.base || "USD").toUpperCase();
    const quoteCurrency = String(req.query.quote || "ARS").toUpperCase();
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rate = await getExchangeRate({ baseCurrency, quoteCurrency, date });
    res.json(rate);
  } catch (error) {
    next(error);
  }
});

router.post("/demo/seed", async (_req, res, next) => {
  try {
    const { default: seed } = await import("../db/seed.js");
    await seed();
    res.status(201).json({ message: "Datos dummy cargados." });
  } catch (error) {
    next(error);
  }
});

export default router;
