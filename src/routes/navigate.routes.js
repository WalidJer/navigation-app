import { Router } from "express";
import { pool } from "../db/pool.js";
import { haversineMeters } from "../utils/geo.utils.js";

export const navigateRouter = Router();

function isValidCoord(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// POST /api/navigate
// Body: { address: string, from:{lat,lng}, speedMps?: number }
navigateRouter.post("/", async (req, res) => {
  const address = (req.body?.address || "").trim();
  const from = req.body?.from;
  const speedMps = req.body?.speedMps;

  if (!address) {
    return res.status(400).json({ error: { message: "Address is required.", status: 400 } });
  }

  if (!from || !isValidCoord(from.lat) || !isValidCoord(from.lng)) {
    return res.status(400).json({
      error: { message: "Body must include { from:{lat,lng} } as numbers.", status: 400 }
    });
  }

  // ──────────────────────────────────────────────────────────────
  // 1) GEOCODE (Nominatim)
  // ──────────────────────────────────────────────────────────────
  const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
  geoUrl.searchParams.set("q", address);
  geoUrl.searchParams.set("format", "json");
  geoUrl.searchParams.set("limit", "1");

  const geoResp = await fetch(geoUrl.toString(), {
    headers: {
      "User-Agent": "navigation-app-backend-v2/1.0 (dev)",
      "Accept": "application/json"
    }
  });

  if (!geoResp.ok) {
    return res.status(502).json({
      error: { message: `Geocoding failed: HTTP ${geoResp.status}`, status: 502 }
    });
  }

  const geoData = await geoResp.json();
  if (!Array.isArray(geoData) || geoData.length === 0) {
    return res.status(404).json({ error: { message: "Address not found.", status: 404 } });
  }

  const first = geoData[0];
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  const displayName = first.display_name;

  // ──────────────────────────────────────────────────────────────
  // 2) SAVE DESTINATION TO DB
  // ──────────────────────────────────────────────────────────────
  const insert = `
    INSERT INTO saved_addresses (address_text, latitude, longitude)
    VALUES ($1, $2, $3)
    RETURNING id, address_text AS address, latitude, longitude, created_at
  `;
  const saved = await pool.query(insert, [address, latitude, longitude]);
  const destination = saved.rows[0];

  // ──────────────────────────────────────────────────────────────
  // 3) ROUTE (OSRM)
  // ──────────────────────────────────────────────────────────────
  const coords = `${from.lng},${from.lat};${longitude},${latitude}`;
  const routeUrl = new URL(`https://router.project-osrm.org/route/v1/driving/${coords}`);
  routeUrl.searchParams.set("overview", "full");
  routeUrl.searchParams.set("geometries", "geojson");
  routeUrl.searchParams.set("steps", "false");

  const routeResp = await fetch(routeUrl.toString(), {
    headers: {
      "User-Agent": "navigation-app-backend/1.0 (dev)",
      "Accept": "application/json"
    }
  });

  if (!routeResp.ok) {
    return res.status(502).json({
      error: { message: `Routing failed: HTTP ${routeResp.status}`, status: 502 }
    });
  }

  const routeData = await routeResp.json();
  if (routeData.code !== "Ok" || !routeData.routes?.length) {
    return res.status(404).json({ error: { message: "Route not found.", status: 404 } });
  }

  const r = routeData.routes[0];
  const route = {
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: r.geometry
  };

  // ──────────────────────────────────────────────────────────────
  // 4) LIVE METRICS (remaining + ETA)
  // ──────────────────────────────────────────────────────────────
  const to = { lat: latitude, lng: longitude };
  const remainingMeters = haversineMeters(from, to);

  let etaSeconds = null;
  if (isValidCoord(speedMps) && speedMps > 0.5) {
    etaSeconds = remainingMeters / speedMps;
  }

  const live = {
    remainingMeters,
    remainingKm: remainingMeters / 1000,
    etaSeconds,
    etaMinutes: etaSeconds != null ? etaSeconds / 60 : null
  };

  // ──────────────────────────────────────────────────────────────
  // RESPONSE
  // ──────────────────────────────────────────────────────────────
  return res.status(201).json({
    destination: {
      ...destination,
      displayName
    },
    route,
    live
  });
});