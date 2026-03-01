import axios, { AxiosInstance } from 'axios';
import {
  Market,
  PolymarketEventResponse,
  PolymarketMarketResponse,
  PolymarketTradeResponse,
  Trade,
  Wallet,
} from '../../shared/types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const DATA_BASE = 'https://data-api.polymarket.com';

export class PolymarketClient {
  private session: AxiosInstance;

  constructor() {
    this.session = axios.create({
      headers: {
        'User-Agent': 'polymarket-tracker/2.0',
      },
      timeout: 15000,
    });
  }

  /**
   * Fetch active, unresolved politics markets using the /events endpoint
   * tag_id=2 = Politics. closed=false filters out resolved markets.
   */
  async fetchPoliticsMarkets(): Promise<Market[]> {
    const markets: Market[] = [];
    let offset = 0;
    const limit = 100;
    const maxPages = 10;

    for (let page = 0; page < maxPages; page++) {
      try {
        const response = await this.session.get<PolymarketEventResponse[]>(
          `${GAMMA_BASE}/events`,
          {
            params: {
              tag_id: 2, // Politics category
              active: 'true',
              closed: 'false', // Exclude resolved markets
              limit,
              offset,
              order: 'volume24hr',
              ascending: 'false',
            },
          }
        );

        const batch = response.data;
        if (!batch || batch.length === 0) {
          break;
        }

        // Each event contains a nested list of markets
        for (const event of batch) {
          const eventMarkets = event.markets || [];
          for (const m of eventMarkets) {
            const normalized = this.normalizeMarket(m, event);
            if (normalized.id) {
              markets.push(normalized);
            }
          }
        }

        if (batch.length < limit) {
          break;
        }
        offset += limit;
      } catch (error) {
        console.error('[api] Gamma fetch error:', error);
        break;
      }
    }

    console.log(`[api] Fetched ${markets.length} politics markets`);
    return markets;
  }

  /**
   * Normalize a market from Polymarket API format to our internal format
   */
  private normalizeMarket(
    m: PolymarketMarketResponse,
    event: PolymarketEventResponse
  ): Market {
    let tokenIds: string[] = [];

    // Handle clobTokenIds which can be a string or array
    const rawTokenIds = m.clobTokenIds;
    if (typeof rawTokenIds === 'string') {
      try {
        tokenIds = JSON.parse(rawTokenIds);
      } catch {
        tokenIds = [];
      }
    } else if (Array.isArray(rawTokenIds)) {
      tokenIds = rawTokenIds;
    }

    return {
      id: m.conditionId || '',
      question: m.question || event.title || '',
      endDate: m.endDate || event.endDate || '',
      tokenIds,
      slug: event.slug || m.slug || '',
      volume24h: parseFloat(String(m.volume24hr || m.volume || 0)),
    };
  }

  /**
   * Fetch the most recent global trades
   * The market= filter causes URL-length issues with many IDs, so we
   * pull globally and filter client-side by conditionId
   */
  async fetchMarketTrades(limit: number = 10000): Promise<PolymarketTradeResponse[]> {
    try {
      const response = await this.session.get<PolymarketTradeResponse[]>(
        `${DATA_BASE}/trades`,
        {
          params: { limit },
        }
      );

      const data = response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[api] Data API fetch error:', error);
      return [];
    }
  }

  /**
   * Fetch a wallet's full trade history to compute account age and trade count
   * Returns {firstTradeTs, tradeCount} or null on failure
   */
  async fetchWalletProfile(address: string): Promise<Partial<Wallet> | null> {
    try {
      const response = await this.session.get<PolymarketTradeResponse[]>(
        `${DATA_BASE}/trades`,
        {
          params: {
            user: address,
            limit: 500,
          },
        }
      );

      const trades = response.data;
      if (!Array.isArray(trades) || trades.length === 0) {
        return {
          firstTradeTs: null,
          tradeCount: 0,
        };
      }

      const timestamps = trades
        .map((t) => parseInt(String(t.timestamp), 10))
        .filter((ts) => !isNaN(ts));

      return {
        firstTradeTs: timestamps.length > 0 ? Math.min(...timestamps) : null,
        tradeCount: trades.length, // capped at 500; treat 500 as "experienced"
      };
    } catch (error) {
      console.error(`[api] Wallet fetch error (${address.substring(0, 8)}...):`, error);
      return null;
    }
  }

  /**
   * Convert a raw Data API trade into the shape stored in the trades table
   */
  normalizeTrade(raw: PolymarketTradeResponse, marketId: string): Omit<Trade, 'createdAt'> {
    return {
      id: raw.transactionHash || '',
      marketId,
      tokenId: raw.asset || '',
      size: parseFloat(String(raw.size || 0)),
      price: parseFloat(String(raw.price || 0)),
      side: (raw.side || 'buy') as 'buy' | 'sell',
      maker: raw.proxyWallet || '',
      taker: '',
      timestamp: this.normalizeTimestamp(raw.timestamp),
      suspicionScore: 0.0,
    };
  }

  /**
   * Normalize timestamp to ISO string
   */
  private normalizeTimestamp(ts: string | number): string {
    const timestamp = typeof ts === 'string' ? parseInt(ts, 10) : ts;

    // Handle Unix timestamps (seconds or milliseconds)
    if (timestamp > 1e12) {
      return new Date(timestamp).toISOString();
    } else {
      return new Date(timestamp * 1000).toISOString();
    }
  }
}
