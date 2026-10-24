-- Parent-to-parent direct messages. Allowed between co-parents (same family) and between parents
-- whose kids are approved friends. Checked on the server for every read and send.

CREATE TABLE parent_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX parent_messages_pair ON parent_messages (from_id, to_id, id);
CREATE INDEX parent_messages_unread ON parent_messages (to_id, read_at);
