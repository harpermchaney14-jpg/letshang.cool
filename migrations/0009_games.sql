-- Game leaderboards: each kid's personal best per game. Only shown to the kid and their approved friends.
CREATE TABLE game_scores (
  kid_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  best       REAL NOT NULL,
  plays      INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (kid_id, game)
);
CREATE INDEX game_scores_game ON game_scores (game, best);

-- Two-player games between approved friends (Sea Battle, Word Duel). state is JSON; waiting_on = ",id,id," of players who need to act.
CREATE TABLE matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game       TEXT NOT NULL CHECK (game IN ('seabattle','wordduel')),
  p1         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p2         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','done','declined')),
  turn       INTEGER,
  winner     INTEGER,
  waiting_on TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX matches_p1 ON matches (p1, updated_at);
CREATE INDEX matches_p2 ON matches (p2, updated_at);
