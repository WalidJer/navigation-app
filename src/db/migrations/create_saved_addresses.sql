CREATE TABLE IF NOT EXISTS saved_addresses (
  id SERIAL PRIMARY KEY,
  address_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_created_at
  ON saved_addresses (created_at DESC);