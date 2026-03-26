import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../frontend");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.use("/api", apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor." });
});

export default app;

