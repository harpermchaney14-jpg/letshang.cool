-- Stock Market Challenge: play money, REAL stocks with live prices (from Finnhub; needs the FINNHUB_KEY secret).
CREATE TABLE market_accounts (
  kid_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cash       REAL NOT NULL DEFAULT 10000,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resets     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE market_holdings (
  kid_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares INTEGER NOT NULL,
  cost   REAL NOT NULL,              -- total paid for the shares still held
  PRIMARY KEY (kid_id, symbol)
);
CREATE TABLE market_trades (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol  TEXT NOT NULL,
  side    TEXT NOT NULL CHECK (side IN ('buy','sell')),
  shares  INTEGER NOT NULL,
  price   REAL NOT NULL,
  at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX market_trades_kid ON market_trades (kid_id, id);


-- Latest real quotes (refreshed at most about once a minute) and a price history we record for charts.
CREATE TABLE market_quotes (
  sym        TEXT PRIMARY KEY,
  price      REAL NOT NULL,
  prev_close REAL,
  open       REAL,
  high       REAL,
  low        REAL,
  quote_time INTEGER,
  fetched_at TEXT NOT NULL
);
CREATE TABLE market_history (
  sym   TEXT NOT NULL,
  at    TEXT NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (sym, at)
);
CREATE TABLE market_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
