-- Let's Hang v2 — friends, 1:1 chat, plans with parent approval, notifications.
-- Replaces the earlier host-house check-in schema (0001/0002), which is dropped here.

DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS checkins;
DROP TABLE IF EXISTS houses;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS sms_log;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS crews;

CREATE TABLE families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role           TEXT NOT NULL CHECK (role IN ('parent','kid')),
  display_name   TEXT NOT NULL,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash      TEXT NOT NULL,
  pass_salt      TEXT NOT NULL,
  avatar         TEXT NOT NULL DEFAULT 'star',      -- preset avatar key, no photos stored
  friend_code    TEXT UNIQUE,                       -- kids only, e.g. HANG-7KQ2
  phone          TEXT,                              -- parents (and optionally kids), E.164
  sms_opt_in     INTEGER NOT NULL DEFAULT 0,
  notify_prefs   TEXT NOT NULL DEFAULT '{}',        -- JSON: { messages, friends, plans, ready }
  chat_enabled   INTEGER NOT NULL DEFAULT 1,        -- parent can pause a kid's chat
  onboarded      INTEGER NOT NULL DEFAULT 0,
  consent_at     TEXT,                              -- when a parent consented for this kid
  consent_by     INTEGER,
  recovery_hash  TEXT,                              -- parents: hashed one-time recovery code
  recovery_salt  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_family ON users(family_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- generic rate limiting (login attempts, friend-code lookups, messages, …)
CREATE TABLE rate_events (
  key TEXT NOT NULL,
  at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_rate_events ON rate_events(key, at);

-- One row per pair of kids (kid_a < kid_b).
-- pending → (friend accepts) → awaiting_parent → (both parents approve) → active
CREATE TABLE friendships (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_a         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kid_b         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('pending','awaiting_parent','active','declined','removed')),
  parent_ok_a   INTEGER NOT NULL DEFAULT 0,
  parent_ok_b   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (kid_a, kid_b),
  CHECK (kid_a < kid_b)
);

CREATE TABLE blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id  INTEGER,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 1:1 messages between kids in an active friendship
CREATE TABLE messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  friendship_id INTEGER NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
  sender_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_messages_conv ON messages(friendship_id, id);

CREATE TABLE chat_reads (
  friendship_id INTEGER NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (friendship_id, user_id)
);

-- parent <-> own kid messages ("Contact child" / "Contact parent")
CREATE TABLE family_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_family_messages ON family_messages(family_id, id);

-- "Made a Plan": every kid in the plan needs their own parent's OK
CREATE TABLE plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  location    TEXT,
  details     TEXT,
  cancelled   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE plan_members (
  plan_id       INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  kid_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_status TEXT NOT NULL DEFAULT 'waiting' CHECK (parent_status IN ('waiting','approved','declined')),
  decided_by    INTEGER,
  decided_at    TEXT,
  PRIMARY KEY (plan_id, kid_id)
);
CREATE INDEX idx_plan_members_kid ON plan_members(kid_id);

CREATE TABLE ready_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_ready_kid ON ready_events(kid_id, id);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,     -- friend_request, friend_accepted, friend_approval, message, plan_approval, plan_update, ready, parent_message, safety
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,              -- client route, e.g. chat:12
  dedupe_key TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, id);

CREATE TABLE sms_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_phone     TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL,
  provider_sid TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
