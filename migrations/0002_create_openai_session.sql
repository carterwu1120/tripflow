-- Single-owner ChatGPT plan session. Holds the owner's OAuth tokens so the
-- worker can call the Responses API on the owner's plan. Exactly one row (id = 1).
CREATE TABLE IF NOT EXISTS openai_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  client_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  model TEXT,
  updated_at TEXT NOT NULL
);
