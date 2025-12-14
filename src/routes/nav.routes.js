import { Router } from "express";
import { haversineMeters } from "../utils/geo.utils.js";

export const navRouter = Router();

function isValidCoord(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// POST /api/nav/metrics
// Body: { from:{lat,lng}, to:{lat,lng}, speedMps?: number }
navRouter.post("/metrics", async (req, res) => {
  const from = req.body?.from;
  const to = req.body?.to;
  const speedMps = req.body?.speedMps;

  if (
    !from || !to ||
    !isValidCoord(from.lat) || !isValidCoord(from.lng) ||
    !isValidCoord(to.lat) || !isValidCoord(to.lng)
  ) {
    return res.status(400).json({
      error: { message: "Body must include { from:{lat,lng}, to:{lat,lng} } as numbers.", status: 400 }
    });
  }

  const remainingMeters = haversineMeters(from, to);

  let etaSeconds = null;
  if (isValidCoord(speedMps) && speedMps > 0.5) {
    etaSeconds = remainingMeters / speedMps;
  }

  res.json({
    remainingMeters,
    remainingKm: remainingMeters / 1000,
    etaSeconds,
    etaMinutes: etaSeconds != null ? etaSeconds / 60 : null
  });
});