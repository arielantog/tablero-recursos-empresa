import { pool } from "../config/db.js";
import { getExchangeRate } from "./exchange-rate.service.js";

const STANDARD_MONTHLY_HOURS = 160;

function countMonthsInRange(from, to) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
    return 1;
  }

  const monthDiff =
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    (toDate.getMonth() - fromDate.getMonth()) +
    1;

  return Math.max(1, monthDiff);
}

export async function getEmployeeMetrics(from, to) {
  const result = await pool.query(
    `SELECT
      pe.id,
      pe.full_name,
      pe.role,
      COALESCE(pe.monthly_salary, 0) AS monthly_salary,
      COALESCE(pe.salary_currency, 'ARS') AS salary_currency,
      COALESCE(SUM(te.hours), 0) AS worked_hours,
      COALESCE(SUM(te.hours * rr.hourly_rate) FILTER (WHERE rr.currency = 'USD'), 0) AS billed_usd,
      COALESCE(SUM(te.hours * rr.hourly_rate) FILTER (WHERE rr.currency = 'ARS'), 0) AS billed_ars
    FROM people pe
    LEFT JOIN time_entries te
      ON te.person_id = pe.id
      AND te.work_date BETWEEN $1 AND $2
    LEFT JOIN LATERAL (
      SELECT resolved.currency, resolved.hourly_rate
      FROM (
        SELECT crr.id AS rule_id, crr.currency, crr.hourly_rate, crr.effective_from, 1 AS priority
        FROM client_rate_rules crr
        WHERE crr.client_id = te.client_id
          AND crr.person_id = te.person_id
          AND crr.billing_category_id = te.billing_category_id
          AND crr.effective_from <= te.work_date

        UNION ALL

        SELECT crr.id AS rule_id, crr.currency, crr.hourly_rate, crr.effective_from, 2 AS priority
        FROM client_rate_rules crr
        WHERE crr.client_id = te.client_id
          AND crr.person_id = te.person_id
          AND crr.billing_category_id IS NULL
          AND crr.effective_from <= te.work_date

        UNION ALL

        SELECT crr.id AS rule_id, crr.currency, crr.hourly_rate, crr.effective_from, 3 AS priority
        FROM client_rate_rules crr
        WHERE crr.client_id = te.client_id
          AND crr.person_id IS NULL
          AND crr.billing_category_id = te.billing_category_id
          AND crr.effective_from <= te.work_date

        UNION ALL

        SELECT cr.id AS rule_id, cr.currency, cr.hourly_rate, cr.effective_from, 4 AS priority
        FROM client_rates cr
        WHERE cr.client_id = te.client_id
          AND cr.effective_from <= te.work_date
      ) resolved
      ORDER BY resolved.priority, resolved.effective_from DESC, resolved.rule_id DESC
      LIMIT 1
    ) rr ON TRUE
    WHERE pe.active = TRUE
    GROUP BY pe.id, pe.full_name, pe.role, pe.monthly_salary, pe.salary_currency
    ORDER BY pe.full_name`,
    [from, to]
  );

  const monthsInRange = countMonthsInRange(from, to);
  const groupedEmployees = new Map();

  for (const row of result.rows) {
    const key = row.full_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const existing = groupedEmployees.get(key);
    const payload = {
      id: row.id,
      full_name: row.full_name,
      role: row.role || "Sin rol",
      salary_currency: row.salary_currency || "ARS",
      monthly_salary: Number(row.monthly_salary),
      worked_hours: Number(row.worked_hours),
      billed_usd: Number(row.billed_usd),
      billed_ars: Number(row.billed_ars)
    };

    if (!existing) {
      groupedEmployees.set(key, payload);
      continue;
    }

    existing.worked_hours += payload.worked_hours;
    existing.billed_usd += payload.billed_usd;
    existing.billed_ars += payload.billed_ars;

    if (payload.monthly_salary > existing.monthly_salary) {
      existing.monthly_salary = payload.monthly_salary;
      existing.salary_currency = payload.salary_currency;
      existing.role = payload.role;
      existing.id = payload.id;
      existing.full_name = payload.full_name;
    }
  }

  const mergedRows = Array.from(groupedEmployees.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "es")
  );

  let totalHours = 0;
  let payrollArsPerMonth = 0;
  let payrollUsdPerMonth = 0;

  const employees = mergedRows.map((row) => {
    const workedHours = Number(row.worked_hours);
    const monthlySalary = Number(row.monthly_salary);
    const salaryCurrency = row.salary_currency || "ARS";
    const costPerHour = monthlySalary > 0 ? monthlySalary / STANDARD_MONTHLY_HOURS : 0;
    const targetHours = STANDARD_MONTHLY_HOURS * monthsInRange;
    const utilizationPct = targetHours > 0 ? (workedHours / targetHours) * 100 : 0;
    const estimatedCost = workedHours * costPerHour;

    totalHours += workedHours;

    if (salaryCurrency === "USD") {
      payrollUsdPerMonth += monthlySalary;
    } else {
      payrollArsPerMonth += monthlySalary;
    }

    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role || "Sin rol",
      salary_currency: salaryCurrency,
      monthly_salary: Number(monthlySalary.toFixed(2)),
      worked_hours: Number(workedHours.toFixed(2)),
      billed_usd: Number(Number(row.billed_usd).toFixed(2)),
      billed_ars: Number(Number(row.billed_ars).toFixed(2)),
      cost_per_hour: Number(costPerHour.toFixed(2)),
      estimated_cost: Number(estimatedCost.toFixed(2)),
      utilization_pct: Number(utilizationPct.toFixed(2))
    };
  });

  let usdArsRate = null;
  let exchangeSource = null;
  let exchangeStatus = "unavailable";
  let exchangeWarning = null;
  let exchangeDateUsed = to;
  let payrollArsEquivalent = payrollArsPerMonth;
  let payrollUsdEquivalent = payrollUsdPerMonth;

  try {
    const rateData = await getExchangeRate({
      baseCurrency: "USD",
      quoteCurrency: "ARS",
      date: to
    });
    usdArsRate = rateData.rate;
    exchangeSource = rateData.source;
    exchangeStatus = rateData.status || "fresh";
    exchangeWarning = rateData.warning || null;
    exchangeDateUsed = rateData.rateDate || to;

    payrollArsEquivalent = payrollArsPerMonth + payrollUsdPerMonth * usdArsRate;
    payrollUsdEquivalent =
      payrollUsdPerMonth + (usdArsRate > 0 ? payrollArsPerMonth / usdArsRate : 0);
  } catch (error) {
    // La API de cotizaciones puede fallar; mantenemos respuesta util sin conversion.
    exchangeWarning = error.message;
  }

  return {
    exchange: {
      usd_ars_rate: usdArsRate ? Number(usdArsRate.toFixed(6)) : null,
      source: exchangeSource,
      date: exchangeDateUsed,
      status: exchangeStatus,
      warning: exchangeWarning
    },
    range: { from, to, months_in_range: monthsInRange },
    totals: {
      people_count: employees.length,
      total_hours: Number(totalHours.toFixed(2)),
      payroll_ars_per_month: Number(payrollArsPerMonth.toFixed(2)),
      payroll_usd_per_month: Number(payrollUsdPerMonth.toFixed(2)),
      payroll_ars_equivalent_per_month: Number(payrollArsEquivalent.toFixed(2)),
      payroll_usd_equivalent_per_month: Number(payrollUsdEquivalent.toFixed(2)),
      payroll_ars_for_range: Number((payrollArsPerMonth * monthsInRange).toFixed(2)),
      payroll_usd_for_range: Number((payrollUsdPerMonth * monthsInRange).toFixed(2))
    },
    employees
  };
}
