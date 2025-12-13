// ──────────────────────────────────────────────────────────────
//              MODULE IMPORTS & INITIAL SETUP
// ──────────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import "./config/env.js";
import { healthRouter } from "./routes/health.routes.js";
import { addressesRouter } from "./routes/addresses.routes.js";


const PORT = process.env.PORT || 4000;
const app = express();

// ──────────────────────────────────────────────────────────────
//                       MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────────────────────
//                          ROUTES
// ──────────────────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/addresses", addressesRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { message: "Not Found", status: 404 } });
});

console.log("DATABASE_URL =", process.env.DATABASE_URL);

// ──────────────────────────────────────────────────────────────
//             DATABASE CONNECTION & SERVER START
// ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});