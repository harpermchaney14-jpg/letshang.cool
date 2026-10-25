-- Walkie-talkie voice clips between approved friends (parents of either kid can listen), and friend code names.
CREATE TABLE voice_clips (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  friendship_id INTEGER NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
  sender_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime          TEXT NOT NULL,
  secs          REAL NOT NULL,
  data          BLOB NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
ALTER TABLE messages ADD COLUMN voice_id INTEGER;
-- code_a = the code name kid_b gave kid_a; code_b = the code name kid_a gave kid_b. Both kids see both.
ALTER TABLE friendships ADD COLUMN code_a TEXT;
ALTER TABLE friendships ADD COLUMN code_b TEXT;
