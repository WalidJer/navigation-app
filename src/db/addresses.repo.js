import { pool } from "./pool.js";

export async function findCachedAddress(addressText) {
  const q = `
    SELECT id, address_text AS address, latitude, longitude, created_at
    FROM saved_addresses
    WHERE address_text = $1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const r = await pool.query(q, [addressText]);
  return r.rows[0] || null;
}
