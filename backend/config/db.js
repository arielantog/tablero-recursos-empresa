import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no esta definida en el archivo .env");
}

const databaseUrl = process.env.DATABASE_URL;
const sanitizedConnectionString = databaseUrl
  .replace(/([?&])sslmode=require(&)?/i, (_match, prefix, suffix) => (prefix === "?" && suffix ? "?" : ""))
  .replace(/[?&]$/, "");
const useSsl =
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("neon.tech");

export const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});
