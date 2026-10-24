-- Host-house check-in/out, pickup heads-ups, and per-family school schedule + walk weather.

ALTER TABLE families ADD COLUMN school_name   TEXT;
ALTER TABLE families ADD COLUMN school_arrive TEXT    NOT NULL DEFAULT '08:40';
ALTER TABLE families ADD COLUMN school_start  TEXT    NOT NULL DEFAULT '09:00';
ALTER TABLE families ADD COLUMN school_end    TEXT    NOT NULL DEFAULT '15:50';
ALTER TABLE families ADD COLUMN walk_minutes  INTEGER NOT NULL DEFAULT 20;
ALTER TABLE families ADD COLUMN walk_miles    REAL    NOT NULL DEFAULT 1.0;
ALTER TABLE families ADD COLUMN location_name TEXT    NOT NULL DEFAULT 'Sioux Falls, SD';
ALTER TABLE families ADD COLUMN lat           REAL    NOT NULL DEFAULT 43.5446;
ALTER TABLE families ADD COLUMN lon           REAL    NOT NULL DEFAULT -96.7311;

-- A family's home that kids can hang at (visible to the family and its kids' approved friends).
CREATE TABLE houses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  notes      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_houses_family ON houses(family_id);

-- Hotel-style stays. Open stay = out_at NULL.
CREATE TABLE checkins (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  session  TEXT NOT NULL DEFAULT 'after' CHECK (session IN ('before','after','other')),
  in_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  out_at   TEXT,
  in_by    INTEGER,
  out_by   INTEGER
);
CREATE INDEX idx_checkins_kid ON checkins(kid_id, in_at);
CREATE INDEX idx_checkins_open ON checkins(kid_id) WHERE out_at IS NULL;

-- "I'm on my way" from a parent to their kid (and the host family).
CREATE TABLE pickups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house_id    INTEGER REFERENCES houses(id) ON DELETE SET NULL,
  from_user   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  eta_minutes INTEGER,
  message     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ack_at      TEXT,
  ack_by      INTEGER
);
CREATE INDEX idx_pickups_kid ON pickups(kid_id, id);
