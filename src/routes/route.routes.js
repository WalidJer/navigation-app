import { Router } from "express";

export const routeRouter = Router();

function isValidCoord(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// POST /api/route
// Body: { from: {lat,lng}, to: {lat,lng} }
routeRouter.post("/", async (req, res) => {
  const from = req.body?.from;
  const to = req.body?.to;

  if (
    !from || !to ||
    !isValidCoord(from.lat) || !isValidCoord(from.lng) ||
    !isValidCoord(to.lat) || !isValidCoord(to.lng)
  ) {
    return res.status(400).json({
      error: { message: "Body must include { from:{lat,lng}, to:{lat,lng} } as numbers.", status: 400 }
    });
  }

  // OSRM expects "lng,lat"
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;

  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coords}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const resp = await fetch(url.toString(), {
    headers: {
      "User-Agent": "navigation-app-backend-v2/1.0 (dev)",
      "Accept": "application/json"
    }
  });

  if (!resp.ok) {
    return res.status(502).json({
      error: { message: `Routing failed: HTTP ${resp.status}`, status: 502 }
    });
  }

  const data = await resp.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    return res.status(404).json({ error: { message: "Route not found.", status: 404 } });
  }

  const r = data.routes[0];

  return res.json({
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: r.geometry 
  });
});