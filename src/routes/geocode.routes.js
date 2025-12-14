import { Router } from "express";
import { pool } from "../db/pool.js";
import { sendError } from "../utils/http.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { findCachedAddress } from "../db/addresses.repo.js";

export const geocodeRouter = Router();

// POST /api/geocode  { "address": "123 Main St, St. John's, NL" }
geocodeRouter.post("/", rateLimit({ windowMs: 1000, max: 1 }), async (req, res) => {
  const address = (req.body?.address || "").trim();
  if (!address) return sendError(res, 400, "Address is required.");

// 1) CACHE FIRST
  const cached = await findCachedAddress(address);
  if (cached) {
    return res.json({
      ...cached,
      cached: true
    });
  }


  // 2) GEOCODE (Nominatim)
  // Nominatim search endpoint
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const resp = await fetch(url.toString(), {
    headers: {
      // Nominatim expects a descriptive User-Agent
      "User-Agent": "navigation-app-backend/1.0 (dev)",
      "Accept": "application/json"
    }
  });

  if (!resp.ok) return sendError(res, 502, `Geocoding failed: HTTP ${resp.status}`);

  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) return sendError(res, 404, "Address not found.");

  const first = data[0];
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  const displayName = first.display_name;

   // 3) SAVE
  // Save address + coords
  const insert = `
    INSERT INTO saved_addresses (address_text, latitude, longitude)
    VALUES ($1, $2, $3)
    RETURNING id, address_text AS address, latitude, longitude, created_at
  `;
  const result = await pool.query(insert, [address, latitude, longitude]);

  return res.status(201).json({
    ...result.rows[0],
    displayName
  });
});