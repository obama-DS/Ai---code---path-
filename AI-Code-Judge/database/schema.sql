-- ─────────────────────────────────────────────────────────────────────────────
-- AI Code Judge — SQLite reference schema
-- This file is for documentation / manual inspection only.
-- Tables are created automatically by SQLAlchemy via database.py.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    first_name    TEXT,
    is_admin      BOOLEAN NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS judgments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    language     TEXT    NOT NULL,
    code         TEXT    NOT NULL,
    score        INTEGER NOT NULL,
    result_json  TEXT    NOT NULL,   -- full AI JSON response
    personality  TEXT    NOT NULL DEFAULT 'friendly',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commits (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_name      TEXT    NOT NULL,
    commit_hash    TEXT    NOT NULL,
    commit_message TEXT    NOT NULL,
    language       TEXT,
    score          INTEGER,
    judgment_id    INTEGER REFERENCES judgments(id) ON DELETE SET NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_judgments_user    ON judgments(user_id);
CREATE INDEX IF NOT EXISTS idx_judgments_created ON judgments(created_at);
CREATE INDEX IF NOT EXISTS idx_commits_user      ON commits(user_id);
CREATE INDEX IF NOT EXISTS idx_commits_created   ON commits(created_at);
