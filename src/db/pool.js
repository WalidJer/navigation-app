import pkg from "pg";
import { URL } from "url";
import "../config/env.js";

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Make sure .env exists in project root.");
}

const dbUrl = new URL(process.env.DATABASE_URL);

export const pool = new Pool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 5432),
  database: dbUrl.pathname.replace("/", ""),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password), // ✅ ensures it's a string
});

export async function pingDb() {
  const r = await pool.query("SELECT 1 AS ok");
  return r.rows[0]?.ok === 1;
}