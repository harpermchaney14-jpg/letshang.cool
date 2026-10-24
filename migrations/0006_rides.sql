-- Ride requests: a kid asks for a parent pickup or drop-off for themselves + friends (rain, snow, cold, …).
-- Every rider's parents are asked; the first parent to tap "I've got it" claims the ride.

CREATE TABLE rides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('pickup','dropoff')),
  reason        TEXT NOT NULL DEFAULT 'other' CHECK (reason IN ('rain','snow','storm','cold','other')),
  starts_at     TEXT NOT NULL,
  from_place    TEXT NOT NULL,
  to_place      TEXT NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','cancelled')),
  claimed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX rides_starts ON rides (starts_at);

CREATE TABLE ride_riders (
  ride_id  INTEGER NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  kid_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (ride_id, kid_id)
);
CREATE INDEX ride_riders_kid ON ride_riders (kid_id);
