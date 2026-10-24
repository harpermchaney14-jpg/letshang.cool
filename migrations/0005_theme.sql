-- Each person picks their own look: 'neon' (default) or 'pastel'.
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'neon';
