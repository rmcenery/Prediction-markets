// Shared TypeScript types for Polymarket Tracker

export interface Market {
  id: string; // conditionId
  question: string;
  endDate: string; // ISO timestamp
  tokenIds: string[]; // Array of token IDs
  slug: string;
  volume24h: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Trade {
  id: string; // transactionHash
  marketId: string;
  tokenId: string;
  size: number;
  price: number;
  side: 'buy' | 'sell';
  maker: string; // wallet address
  taker: string; // wallet address
  timestamp: string; // ISO timestamp
  suspicionScore: number;
  createdAt?: string;
}

export interface Alert {
  id: number;
  tradeId: string;
  marketId: string;
  question: string;
  score: number;
  signals: string[]; // Array of signal descriptions
  firedAt: string; // ISO timestamp
}

export interface WatchlistEntry {
  address: string;
  firstSeen: string; // ISO timestamp
  alertCount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Wallet {
  address: string;
  firstTradeTs: number | null; // Unix timestamp
  tradeCount: number;
  fetchedAt: number; // Unix timestamp
  createdAt?: string;
  updatedAt?: string;
}

export interface DetectionConfig {
  zScoreThreshold: number;
  volumePctThreshold: number;
  preResolutionHours: number;
  suspicionThreshold: number;
  rollingWindow: number;
  pollIntervalSeconds: number;
  marketRefreshMinutes: number;
  tradesPerFetch: number;
}

export interface DashboardStats {
  totalAlerts: number;
  alertsToday: number;
  alertsThisWeek: number;
  alertsThisMonth: number;
  marketsTracked: number;
  watchlistCount: number;
  totalTrades: number;
}

export interface SuspicionSignal {
  type: 'large_position' | 'volume_pct' | 'pre_resolution' | 'fresh_wallet' | 'new_wallet' | 'new_account' | 'young_account';
  description: string;
  value?: number;
}

export interface ScoringResult {
  score: number;
  signals: SuspicionSignal[];
}

// WebSocket event types
export type WSEvent =
  | { type: 'trade:new'; data: Trade }
  | { type: 'alert:fired'; data: Alert & { market: Market; trade: Trade } }
  | { type: 'market:updated'; data: Market }
  | { type: 'stats:updated'; data: DashboardStats };

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Polymarket API types
export interface PolymarketMarketResponse {
  conditionId: string;
  question: string;
  endDate: string;
  clobTokenIds: string | string[];
  volume24hr?: number;
  volume?: number;
  slug?: string;
}

export interface PolymarketEventResponse {
  markets: PolymarketMarketResponse[];
  title?: string;
  slug?: string;
  endDate?: string;
}

export interface PolymarketTradeResponse {
  transactionHash: string;
  conditionId: string;
  asset: string;
  size: string | number;
  price: string | number;
  side: string;
  proxyWallet: string;
  timestamp: string | number;
}
