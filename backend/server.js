import dotenv from "dotenv";
import app from "./app.js";
import { warmupExchangeRates } from "./services/exchange-rate.service.js";

dotenv.config();

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);

  warmupExchangeRates().catch(() => {});
});
