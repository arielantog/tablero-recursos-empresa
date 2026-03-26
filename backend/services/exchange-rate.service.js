import { pool } from "../config/db.js";

const BCRA_USD_CODE = "USD";

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapStoredRate(row) {
  if (!row) return null;
  const rowDate =
    row.rate_date instanceof Date ? row.rate_date.toISOString().slice(0, 10) : toIsoDate(row.rate_date);
  return {
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    rateDate: rowDate,
    rate: Number(row.rate),
    source: row.source
  };
}

async function getStoredRateExact(baseCurrency, quoteCurrency, rateDate) {
  const result = await pool.query(
    `SELECT base_currency, quote_currency, rate, rate_date, source
     FROM exchange_rates
     WHERE base_currency = $1
       AND quote_currency = $2
       AND rate_date = $3
     LIMIT 1`,
    [baseCurrency, quoteCurrency, rateDate]
  );
  return mapStoredRate(result.rows[0]);
}

async function getLatestStoredRate(baseCurrency, quoteCurrency, rateDate) {
  const result = await pool.query(
    `SELECT base_currency, quote_currency, rate, rate_date, source
     FROM exchange_rates
     WHERE base_currency = $1
       AND quote_currency = $2
       AND rate_date <= $3
     ORDER BY rate_date DESC
     LIMIT 1`,
    [baseCurrency, quoteCurrency, rateDate]
  );
  return mapStoredRate(result.rows[0]);
}

async function upsertRate({ baseCurrency, quoteCurrency, rateDate, rate, source }) {
  await pool.query(
    `INSERT INTO exchange_rates(base_currency, quote_currency, rate_date, rate, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(base_currency, quote_currency, rate_date)
     DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, updated_at = NOW()`,
    [baseCurrency, quoteCurrency, rateDate, rate, source]
  );
}

async function fetchBcraUsdArsByDate(rateDate) {
  const url = new URL(
    `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/${BCRA_USD_CODE}`
  );
  url.searchParams.set("fechaDesde", rateDate);
  url.searchParams.set("fechaHasta", rateDate);
  url.searchParams.set("limit", "10");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BCRA error ${response.status}`);
  }

  const payload = await response.json();
  const rows = payload?.results || [];
  if (!rows.length) {
    return null;
  }

  const first = rows[0];
  const detail = first?.detalle?.find((item) => item.codigoMoneda === BCRA_USD_CODE);
  if (!detail?.tipoCotizacion) {
    return null;
  }

  return {
    rateDate: first.fecha,
    usdArs: Number(detail.tipoCotizacion)
  };
}

async function fetchBcraRate(baseCurrency, quoteCurrency, rateDate) {
  if (baseCurrency === quoteCurrency) {
    return { rate: 1, rateDate, source: "identity" };
  }

  const pair = `${baseCurrency}/${quoteCurrency}`;
  const inversePair = `${quoteCurrency}/${baseCurrency}`;
  const supported = pair === "USD/ARS" || inversePair === "USD/ARS";

  if (!supported) {
    return null;
  }

  // Busca hasta 10 dias hacia atras por fines de semana/feriados.
  for (let delta = 0; delta <= 10; delta += 1) {
    const targetDate = new Date(`${rateDate}T00:00:00`);
    targetDate.setDate(targetDate.getDate() - delta);
    const lookupDate = targetDate.toISOString().slice(0, 10);
    const bcraData = await fetchBcraUsdArsByDate(lookupDate);
    if (!bcraData) continue;

    const usdArs = bcraData.usdArs;
    const rate = baseCurrency === "USD" ? usdArs : 1 / usdArs;
    return {
      rate,
      rateDate: bcraData.rateDate || lookupDate,
      source: "bcra"
    };
  }

  return null;
}

async function fetchFrankfurterRate(baseCurrency, quoteCurrency, rateDate) {
  if (baseCurrency === quoteCurrency) {
    return { rate: 1, rateDate, source: "identity" };
  }

  const isLatest = rateDate === new Date().toISOString().slice(0, 10);
  const endpoint = isLatest ? "latest" : rateDate;
  const url = new URL(`https://api.frankfurter.dev/v1/${endpoint}`);
  url.searchParams.set("base", baseCurrency);
  url.searchParams.set("symbols", quoteCurrency);

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const rate = payload?.rates?.[quoteCurrency];
  if (!rate) {
    return null;
  }

  return {
    rate: Number(rate),
    rateDate: payload.date || rateDate,
    source: "frankfurter"
  };
}

async function fetchExternalRate(base, quote, rateDate) {
  if (base === "ARS" || quote === "ARS") {
    const fromBcra = await fetchBcraRate(base, quote, rateDate);
    if (fromBcra) return fromBcra;

    if (base !== "USD" && quote !== "USD") {
      const baseToUsd = await fetchFrankfurterRate(base, "USD", rateDate);
      const usdToArs = await fetchBcraRate("USD", "ARS", rateDate);

      if (baseToUsd && usdToArs && quote === "ARS") {
        return {
          rate: baseToUsd.rate * usdToArs.rate,
          rateDate: usdToArs.rateDate,
          source: "frankfurter+bcra"
        };
      }

      if (baseToUsd && usdToArs && base === "ARS") {
        return {
          rate: 1 / (baseToUsd.rate * usdToArs.rate),
          rateDate: usdToArs.rateDate,
          source: "frankfurter+bcra"
        };
      }
    }

    return null;
  }

  return fetchFrankfurterRate(base, quote, rateDate);
}

export async function getExchangeRate({ baseCurrency, quoteCurrency, date, allowStale = true }) {
  const base = String(baseCurrency || "").toUpperCase();
  const quote = String(quoteCurrency || "").toUpperCase();
  const rateDate = toIsoDate(date);

  if (!base || !quote) {
    throw new Error("Monedas invalidas para conversion.");
  }

  if (base === quote) {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rateDate,
      rate: 1,
      source: "identity",
      status: "identity",
      stale: false
    };
  }

  const exact = await getStoredRateExact(base, quote, rateDate);
  if (exact) {
    return {
      ...exact,
      status: "cached",
      stale: false
    };
  }

  const fallbackStored = allowStale ? await getLatestStoredRate(base, quote, rateDate) : null;

  try {
    const fetched = await fetchExternalRate(base, quote, rateDate);
    if (!fetched) {
      throw new Error("Sin respuesta de proveedores externos.");
    }

    const normalizedRate = Number(fetched.rate);
    await upsertRate({
      baseCurrency: base,
      quoteCurrency: quote,
      rateDate,
      rate: normalizedRate,
      source: fetched.source
    });

    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rateDate,
      rate: normalizedRate,
      source: fetched.source,
      status: "fresh",
      stale: false
    };
  } catch (error) {
    if (fallbackStored) {
      return {
        ...fallbackStored,
        status: "stale",
        stale: true,
        warning: `No se pudo actualizar desde API externa: ${error.message}`
      };
    }
    throw new Error(`No se pudo obtener cotizacion para ${base}/${quote} en ${rateDate}`);
  }
}

export async function warmupExchangeRates(date = new Date().toISOString().slice(0, 10)) {
  const warmups = [
    getExchangeRate({ baseCurrency: "USD", quoteCurrency: "ARS", date, allowStale: true }),
    getExchangeRate({ baseCurrency: "EUR", quoteCurrency: "USD", date, allowStale: true })
  ];
  return Promise.allSettled(warmups);
}
