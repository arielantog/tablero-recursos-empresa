import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restoreInitialSnapshot() {
  const snapshotPath = path.join(__dirname, "backup-inicial.sql");
  const sql = await fs.readFile(snapshotPath, "utf8");
  await pool.query(sql);
  console.log("Snapshot inicial restaurado correctamente.");
}

restoreInitialSnapshot()
  .catch((err) => {
    console.error("Error restaurando snapshot inicial:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
