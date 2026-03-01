import sqlite3
import json
from config import DB_PATH


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS markets (
                id          TEXT PRIMARY KEY,
                question    TEXT,
                end_date    TEXT,
                token_ids   TEXT,  -- JSON array
                slug        TEXT,
                volume_24h  REAL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS trades (
                id              TEXT PRIMARY KEY,
                market_id       TEXT,
                token_id        TEXT,
                size            REAL,
                price           REAL,
                side            TEXT,
                maker           TEXT,
                taker           TEXT,
                timestamp       TEXT,
                suspicion_score REAL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id    TEXT UNIQUE,
                market_id   TEXT,
                question    TEXT,
                score       REAL,
                signals     TEXT,  -- JSON list of signal descriptions
                fired_at    TEXT
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                address     TEXT PRIMARY KEY,
                first_seen  TEXT,
                alert_count INTEGER DEFAULT 1,
                notes       TEXT
            );

            CREATE TABLE IF NOT EXISTS wallets (
                address         TEXT PRIMARY KEY,
                first_trade_ts  INTEGER,  -- Unix timestamp of earliest known trade
                trade_count     INTEGER,
                fetched_at      INTEGER   -- Unix timestamp of when we last fetched
            );
        """)


# --- Markets ---

def upsert_market(market: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO markets (id, question, end_date, token_ids, slug, volume_24h)
            VALUES (:id, :question, :end_date, :token_ids, :slug, :volume_24h)
            ON CONFLICT(id) DO UPDATE SET
                end_date   = excluded.end_date,
                volume_24h = excluded.volume_24h
        """, market)


def get_all_markets() -> list:
    with get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM markets").fetchall()]


# --- Trades ---

def trade_exists(trade_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM trades WHERE id = ?", (trade_id,)).fetchone()
        return row is not None


def insert_trade(trade: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO trades
                (id, market_id, token_id, size, price, side, maker, taker, timestamp, suspicion_score)
            VALUES
                (:id, :market_id, :token_id, :size, :price, :side, :maker, :taker, :timestamp, :suspicion_score)
        """, trade)


def get_recent_trade_sizes(market_id: str, limit: int) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT size FROM trades WHERE market_id = ? ORDER BY timestamp DESC LIMIT ?",
            (market_id, limit)
        ).fetchall()
        return [r["size"] for r in rows]


# --- Alerts ---

def alert_exists(trade_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM alerts WHERE trade_id = ?", (trade_id,)).fetchone()
        return row is not None


def insert_alert(alert: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO alerts (trade_id, market_id, question, score, signals, fired_at)
            VALUES (:trade_id, :market_id, :question, :score, :signals, :fired_at)
        """, alert)


# --- Wallets ---

def get_wallet(address: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM wallets WHERE address = ?", (address,)).fetchone()
        return dict(row) if row else None


def upsert_wallet(address: str, first_trade_ts: int, trade_count: int, fetched_at: int):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO wallets (address, first_trade_ts, trade_count, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                first_trade_ts = excluded.first_trade_ts,
                trade_count    = excluded.trade_count,
                fetched_at     = excluded.fetched_at
        """, (address, first_trade_ts, trade_count, fetched_at))


# --- Watchlist ---

def upsert_watchlist(address: str, first_seen: str):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO watchlist (address, first_seen, alert_count)
            VALUES (?, ?, 1)
            ON CONFLICT(address) DO UPDATE SET alert_count = alert_count + 1
        """, (address, first_seen))


def is_on_watchlist(address: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM watchlist WHERE address = ?", (address,)).fetchone()
        return row is not None


def get_watchlist() -> list:
    with get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM watchlist ORDER BY alert_count DESC").fetchall()]
