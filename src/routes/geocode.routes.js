import { Router } from "express";
import { pool } from "../db/pool.js";

export const geocodeRouter = Router();

// POST /api/geocode  { "address": "123 Main St, St. John's, NL" }
geocodeRouter.post("/", async (req, res) => {
  const address = (req.body?.address || "").trim();
  if (!address) {
    return res.status(400).json({ error: { message: "Address is required.", status: 400 } });
  }

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

  if (!resp.ok) {
    return res.status(502).json({
      error: { message: `Geocoding failed: HTTP ${resp.status}`, status: 502 }
    });
  }

  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(404).json({ error: { message: "Address not found.", status: 404 } });
  }

  const first = data[0];
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  const displayName = first.display_name;

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