-- Inferred reconstruction schema. Never apply to an unidentified existing database.
CREATE TABLE IF NOT EXISTS library_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  document TEXT NOT NULL CHECK (json_valid(document)),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  document TEXT NOT NULL CHECK (json_valid(document)),
  sha256 TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_created ON snapshots(created_at);
CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS media_uploads (object_key TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, kind TEXT NOT NULL,
  created_at TEXT NOT NULL, cooldown_until INTEGER NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}', released_at TEXT
);
CREATE INDEX IF NOT EXISTS security_events_created ON security_events(created_at);
