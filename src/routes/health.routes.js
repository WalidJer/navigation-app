import { Router } from "express";
import { pingDb } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  let db = "unknown";

  try {
    db = (await pingDb()) ? "ok" : "down";
  } catch (err) {
    console.log("DB ping failed:", err); 
    db = "down";
  }

  res.json({
    status: "ok",
    db,
    service: "navigation-app-backend",
    timestamp: new Date().toISOString()
  });
});