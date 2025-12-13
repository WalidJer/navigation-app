import { Router } from "express";
import { pool } from "../db/pool.js";

export const addressesRouter = Router();

// GET /api/addresses?limit=10
addressesRouter.get("/", async (req, res) => {
  const limitRaw = req.query?.limit;
  const limit = Math.min(Math.max(parseInt(limitRaw || "10", 10), 1), 50);

  const q = `
    SELECT id, address_text AS address, created_at
    FROM saved_addresses
    ORDER BY created_at DESC
    LIMIT $1
  `;

  const result = await pool.query(q, [limit]);
  res.json({ items: result.rows });
});

// POST /api/addresses { "address": "123 Main St, St. John's, NL" }
addressesRouter.post("/", async (req, res) => {
  const address = (req.body?.address || "").trim();
  if (!address) {
    return res.status(400).json({ error: { message: "Address is required.", status: 400 } });
  }

  const q = `
    INSERT INTO saved_addresses (address_text)
    VALUES ($1)
    RETURNING id, address_text AS address, created_at
  `;

  const result = await pool.query(q, [address]);
  res.status(201).json(result.rows[0]);
});
