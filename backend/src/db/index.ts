import Database from 'better-sqlite3';
import path from 'path';
import {
  Market,
  Trade,
  Alert,
  WatchlistEntry,
  Wallet,
  DetectionConfig,
} from '../../shared/types';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'tracker.db');

// Initialize database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      end_date TEXT,
      token_ids TEXT,
      slug TEXT,
      volume_24h REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL,
      token_id TEXT,
      size REAL NOT NULL,
      price REAL NOT NULL,
      side TEXT,
      maker TEXT,
      taker TEXT,
      timestamp TEXT NOT NULL,
      suspicion_score REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (market_id) REFERENCES markets(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id TEXT UNIQUE NOT NULL,
      market_id TEXT NOT NULL,
      question TEXT NOT NULL,
      score REAL NOT NULL,
      signals TEXT NOT NULL,
      fired_at TEXT NOT NULL,
      FOREIGN KEY (trade_id) REFERENCES trades(id),
      FOREIGN KEY (market_id) REFERENCES markets(id)
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      address TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL,
      alert_count INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      address TEXT PRIMARY KEY,
      first_trade_ts INTEGER,
      trade_count INTEGER,
      fetched_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_fired_at ON alerts(fired_at DESC);
  `);

  // Initialize default config if not exists
  initDefaultConfig();

  console.log('[db] Database initialized at', DB_PATH);
}

function initDefaultConfig(): void {
  const database = getDb();
  const defaults: DetectionConfig = {
    zScoreThreshold: 1.0,
    volumePctThreshold: 5.0,
    preResolutionHours: 48,
    suspicionThreshold: 1.5,
    rollingWindow: 200,
    pollIntervalSeconds: 1,
    marketRefreshMinutes: 10,
    tradesPerFetch: 10000,
  };

  const stmt = database.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(defaults)) {
    stmt.run(key, JSON.stringify(value));
  }
}

// ========== Markets ==========

export function upsertMarket(market: Omit<Market, 'createdAt' | 'updatedAt'>): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO markets (id, question, end_date, token_ids, slug, volume_24h, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      end_date = excluded.end_date,
      volume_24h = excluded.volume_24h,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    market.id,
    market.question,
    market.endDate,
    JSON.stringify(market.tokenIds),
    market.slug,
    market.volume24h
  );
}

export function getAllMarkets(): Market[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM markets');
  const rows = stmt.all() as any[];

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    endDate: row.end_date,
    tokenIds: JSON.parse(row.token_ids || '[]'),
    slug: row.slug,
    volume24h: row.volume_24h,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getMarketById(id: string): Market | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM markets WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    question: row.question,
    endDate: row.end_date,
    tokenIds: JSON.parse(row.token_ids || '[]'),
    slug: row.slug,
    volume24h: row.volume_24h,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== Trades ==========

export function tradeExists(tradeId: string): boolean {
  const database = getDb();
  const stmt = database.prepare('SELECT 1 FROM trades WHERE id = ?');
  return stmt.get(tradeId) !== undefined;
}

export function insertTrade(trade: Omit<Trade, 'createdAt'>): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO trades
      (id, market_id, token_id, size, price, side, maker, taker, timestamp, suspicion_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    trade.id,
    trade.marketId,
    trade.tokenId,
    trade.size,
    trade.price,
    trade.side,
    trade.maker,
    trade.taker,
    trade.timestamp,
    trade.suspicionScore
  );
}

export function getRecentTradeSizes(marketId: string, limit: number): number[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT size FROM trades
    WHERE market_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(marketId, limit) as any[];
  return rows.map((r) => r.size);
}

export function getAllTrades(limit: number = 100, offset: number = 0): Trade[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM trades
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as any[];
  return rows.map(rowToTrade);
}

export function getTradeById(id: string): Trade | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM trades WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;
  return rowToTrade(row);
}

export function getTradesCount(): number {
  const database = getDb();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM trades');
  const row = stmt.get() as any;
  return row.count;
}

function rowToTrade(row: any): Trade {
  return {
    id: row.id,
    marketId: row.market_id,
    tokenId: row.token_id,
    size: row.size,
    price: row.price,
    side: row.side,
    maker: row.maker,
    taker: row.taker,
    timestamp: row.timestamp,
    suspicionScore: row.suspicion_score,
    createdAt: row.created_at,
  };
}

// ========== Alerts ==========

export function alertExists(tradeId: string): boolean {
  const database = getDb();
  const stmt = database.prepare('SELECT 1 FROM alerts WHERE trade_id = ?');
  return stmt.get(tradeId) !== undefined;
}

export function insertAlert(alert: Omit<Alert, 'id'>): number {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO alerts (trade_id, market_id, question, score, signals, fired_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    alert.tradeId,
    alert.marketId,
    alert.question,
    alert.score,
    JSON.stringify(alert.signals),
    alert.firedAt
  );

  return info.lastInsertRowid as number;
}

export function getAllAlerts(limit: number = 100, offset: number = 0): Alert[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM alerts
    ORDER BY fired_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as any[];
  return rows.map(rowToAlert);
}

export function getAlertById(id: number): Alert | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM alerts WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;
  return rowToAlert(row);
}

export function getAlertsCount(): number {
  const database = getDb();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM alerts');
  const row = stmt.get() as any;
  return row.count;
}

export function getAlertsByDateRange(startDate: string, endDate: string): Alert[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM alerts
    WHERE fired_at >= ? AND fired_at <= ?
    ORDER BY fired_at DESC
  `);

  const rows = stmt.all(startDate, endDate) as any[];
  return rows.map(rowToAlert);
}

function rowToAlert(row: any): Alert {
  return {
    id: row.id,
    tradeId: row.trade_id,
    marketId: row.market_id,
    question: row.question,
    score: row.score,
    signals: JSON.parse(row.signals),
    firedAt: row.fired_at,
  };
}

// ========== Wallets ==========

export function getWallet(address: string): Wallet | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM wallets WHERE address = ?');
  const row = stmt.get(address) as any;

  if (!row) return null;

  return {
    address: row.address,
    firstTradeTs: row.first_trade_ts,
    tradeCount: row.trade_count,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertWallet(
  address: string,
  firstTradeTs: number | null,
  tradeCount: number,
  fetchedAt: number
): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO wallets (address, first_trade_ts, trade_count, fetched_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(address) DO UPDATE SET
      first_trade_ts = excluded.first_trade_ts,
      trade_count = excluded.trade_count,
      fetched_at = excluded.fetched_at,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(address, firstTradeTs, tradeCount, fetchedAt);
}

// ========== Watchlist ==========

export function upsertWatchlist(address: string, firstSeen: string, notes?: string): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO watchlist (address, first_seen, alert_count, notes, updated_at)
    VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(address) DO UPDATE SET
      alert_count = alert_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(address, firstSeen, notes || null);
}

export function getWatchlist(): WatchlistEntry[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM watchlist ORDER BY alert_count DESC');
  const rows = stmt.all() as any[];

  return rows.map((row) => ({
    address: row.address,
    firstSeen: row.first_seen,
    alertCount: row.alert_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function isOnWatchlist(address: string): boolean {
  const database = getDb();
  const stmt = database.prepare('SELECT 1 FROM watchlist WHERE address = ?');
  return stmt.get(address) !== undefined;
}

export function removeFromWatchlist(address: string): void {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM watchlist WHERE address = ?');
  stmt.run(address);
}

export function updateWatchlistNotes(address: string, notes: string): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE watchlist
    SET notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE address = ?
  `);
  stmt.run(notes, address);
}

// ========== Config ==========

export function getConfig(): DetectionConfig {
  const database = getDb();
  const stmt = database.prepare('SELECT key, value FROM config');
  const rows = stmt.all() as any[];

  const config: any = {};
  for (const row of rows) {
    config[row.key] = JSON.parse(row.value);
  }

  return config as DetectionConfig;
}

export function updateConfig(key: keyof DetectionConfig, value: number): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE config
    SET value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE key = ?
  `);
  stmt.run(JSON.stringify(value), key);
}
