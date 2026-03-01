import { Market, Trade, Wallet, ScoringResult, SuspicionSignal, DetectionConfig } from '../../../shared/types';
import { getRecentTradeSizes } from '../db';

/**
 * Score a trade for suspiciousness
 * Returns {score, signals} where score > threshold means fire an alert
 */
export function scoreTrade(
  trade: Omit<Trade, 'createdAt'>,
  market: Market,
  wallet: Partial<Wallet> | null,
  config: DetectionConfig
): ScoringResult {
  const signals: SuspicionSignal[] = [];

  const largeScore = getLargeTradeScore(trade, market, signals, config);
  const timingMultiplier = getTimingMultiplier(trade, market, signals, config);
  const walletMultiplier = getWalletMultiplier(wallet, trade.timestamp, signals);

  const score = largeScore * timingMultiplier * walletMultiplier;

  return { score, signals };
}

/**
 * Returns true if the score exceeds the suspicion threshold
 */
export function isSuspicious(score: number, config: DetectionConfig): boolean {
  return score >= config.suspicionThreshold;
}

/**
 * Returns a score >= 1.0 if the trade is unusually large, else 0.0
 * Checks two sub-signals: Z-score vs rolling history, and % of 24h volume
 */
function getLargeTradeScore(
  trade: Omit<Trade, 'createdAt'>,
  market: Market,
  signals: SuspicionSignal[],
  config: DetectionConfig
): number {
  const size = trade.size;
  if (size <= 0) {
    return 0.0;
  }

  let zScoreHit = false;
  let volPctHit = false;

  // --- Z-score against rolling window ---
  const recentSizes = getRecentTradeSizes(trade.marketId, config.rollingWindow);
  if (recentSizes.length >= 10) {
    const mean = recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length;
    const stdev = calculateStdDev(recentSizes, mean);

    if (stdev > 0) {
      const z = (size - mean) / stdev;
      if (z >= config.zScoreThreshold) {
        zScoreHit = true;
        signals.push({
          type: 'large_position',
          description: `Large position (${z.toFixed(1)}x sigma above avg size of $${mean.toFixed(0)})`,
          value: z,
        });
      }
    }
  }

  // --- % of 24h volume ---
  const volume24h = market.volume24h || 0;
  if (volume24h > 0) {
    const pct = (size / volume24h) * 100;
    if (pct >= config.volumePctThreshold) {
      volPctHit = true;
      signals.push({
        type: 'volume_pct',
        description: `Trade is ${pct.toFixed(1)}% of 24h market volume ($${volume24h.toFixed(0)})`,
        value: pct,
      });
    }
  }

  return zScoreHit || volPctHit ? 1.0 : 0.0;
}

/**
 * Returns a multiplier based on proximity to market resolution
 * 1.0 = no timing signal; higher = closer to end date
 */
function getTimingMultiplier(
  trade: Omit<Trade, 'createdAt'>,
  market: Market,
  signals: SuspicionSignal[],
  config: DetectionConfig
): number {
  if (!market.endDate) {
    return 1.0;
  }

  try {
    const endDate = parseIsoOrUnix(market.endDate);
    const tradeDate = parseIsoOrUnix(trade.timestamp);

    const hoursRemaining = (endDate.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      // Market already resolved, skip timing signal
      return 1.0;
    }

    if (hoursRemaining <= config.preResolutionHours) {
      // Score scales from 1.5 (at 48h) up to 3.0 (at 0h)
      const multiplier = 1.5 + 1.5 * (1 - hoursRemaining / config.preResolutionHours);
      signals.push({
        type: 'pre_resolution',
        description: `Pre-resolution: ${hoursRemaining.toFixed(1)}h before market closes`,
        value: hoursRemaining,
      });
      return multiplier;
    }
  } catch (error) {
    // Invalid date format, return neutral
    return 1.0;
  }

  return 1.0;
}

/**
 * Boosts score for wallets that are new or have very few trades
 * Returns 1.0 if no wallet data available (neutral — don't penalize missing data)
 */
function getWalletMultiplier(
  wallet: Partial<Wallet> | null,
  tradeTimestamp: string,
  signals: SuspicionSignal[]
): number {
  if (!wallet) {
    return 1.0;
  }

  const tradeCount = wallet.tradeCount || 0;
  const firstTradeTs = wallet.firstTradeTs;

  let boost = 1.0;

  // Very inexperienced wallet
  if (tradeCount < 5) {
    boost = Math.max(boost, 2.0);
    signals.push({
      type: 'fresh_wallet',
      description: `Fresh wallet: only ${tradeCount} total trades on Polymarket`,
      value: tradeCount,
    });
  } else if (tradeCount < 20) {
    boost = Math.max(boost, 1.5);
    signals.push({
      type: 'new_wallet',
      description: `New wallet: only ${tradeCount} total trades on Polymarket`,
      value: tradeCount,
    });
  }

  // Young account by age
  if (firstTradeTs) {
    try {
      const tradeDate = parseIsoOrUnix(tradeTimestamp);
      const accountAgeDays = (tradeDate.getTime() / 1000 - firstTradeTs) / 86400;

      if (accountAgeDays < 7) {
        boost = Math.max(boost, 2.0);
        signals.push({
          type: 'new_account',
          description: `New account: first trade was ${accountAgeDays.toFixed(1)} days ago`,
          value: accountAgeDays,
        });
      } else if (accountAgeDays < 30) {
        boost = Math.max(boost, 1.3);
        signals.push({
          type: 'young_account',
          description: `Young account: first trade was ${accountAgeDays.toFixed(0)} days ago`,
          value: accountAgeDays,
        });
      }
    } catch {
      // Invalid date, ignore
    }
  }

  return boost;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Parse ISO 8601 or Unix timestamp string to Date
 */
function parseIsoOrUnix(s: string): Date {
  const trimmed = s.trim();

  // Handle Unix timestamps (seconds or milliseconds)
  if (/^\d+$/.test(trimmed)) {
    let ts = parseInt(trimmed, 10);
    if (ts > 1e12) {
      ts = Math.floor(ts / 1000);
    }
    return new Date(ts * 1000);
  }

  // Handle ISO strings
  const isoStr = trimmed.replace('Z', '+00:00');
  return new Date(isoStr);
}
