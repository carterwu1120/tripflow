CREATE TABLE IF NOT EXISTS trip_documents (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by_email TEXT NOT NULL
);
