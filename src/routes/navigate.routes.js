import { Router } from "express";
import { pool } from "../db/pool.js";
import { haversineMeters } from "../utils/geo.utils.js";
import { sendError } from "../utils/http.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { findCachedAddress } from "../db/addresses.repo.js";

export const navigateRouter = Router();

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// POST /api/navigate
// Body: { address: string, from:{lat,lng}, speedMps?: number }
navigateRouter.post("/", rateLimit({ windowMs: 1000, max: 1 }), async (req, res) => {
  const address = (req.body?.address || "").trim();
  const from = req.body?.from;
  const speedMps = req.body?.speedMps;

  if (!address) return sendError(res, 400, "Address is required.");
  if (!from || !isFiniteNumber(from.lat) || !isFiniteNumber(from.lng)) {
    return sendError(res, 400, "Body must include { from:{lat,lng} } as numbers.");
  }

  // ──────────────────────────────────────────────────────────────
  // 1) GEOCODE (cache first, otherwise Nominatim)
  // ──────────────────────────────────────────────────────────────
  const cached = await findCachedAddress(address);

  let latitude;
  let longitude;
  let displayName = null;

  // We'll return a consistent "destination" object
  let destination = cached ?? null;

  if (cached) {
    latitude = cached.latitude;
    longitude = cached.longitude;
  } else {
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
      return sendError(res, 502, `Geocoding failed: HTTP ${geoResp.status}`);
    }

    const geoData = await geoResp.json();
    if (!Array.isArray(geoData) || geoData.length === 0) {
      return sendError(res, 404, "Address not found.");
    }

    const first = geoData[0];
    latitude = Number(first.lat);
    longitude = Number(first.lon);
    displayName = first.display_name;

    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
      return sendError(res, 502, "Geocoding returned invalid coordinates.");
    }

    // ──────────────────────────────────────────────────────────────
    // 2) SAVE DESTINATION TO DB
    // ──────────────────────────────────────────────────────────────
    const insert = `
      INSERT INTO saved_addresses (address_text, latitude, longitude)
      VALUES ($1, $2, $3)
      RETURNING id, address_text AS address, latitude, longitude, created_at
    `;
    const saved = await pool.query(insert, [address, latitude, longitude]);
    destination = saved.rows[0];
  }

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
      "User-Agent": "navigation-app-backend-v2/1.0 (dev)",
      "Accept": "application/json"
    }
  });

  if (!routeResp.ok) {
    return sendError(res, 502, `Routing failed: HTTP ${routeResp.status}`);
  }

  const routeData = await routeResp.json();
  if (routeData.code !== "Ok" || !routeData.routes?.length) {
    return sendError(res, 404, "Route not found.");
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
  if (isFiniteNumber(speedMps) && speedMps > 0) {
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
  return res.status(200).json({
    destination: {
      ...destination,
      displayName,
      cached: !!cached
    },
    route,
    live
  });
});