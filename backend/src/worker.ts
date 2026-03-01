import dotenv from 'dotenv';
import * as db from './db';
import { PolymarketClient } from './services/polymarket-client';
import { scoreTrade, isSuspicious } from './services/detector';
import { Market, SuspicionSignal } from '../shared/types';
// import { // broadcastEvent } from './server'; // Commented out to avoid port conflict

dotenv.config();

const polymarket = new PolymarketClient();

// Market index for O(1) lookup during filtering
let marketIndex: Map<string, Market> = new Map();
let lastMarketRefresh = 0;

/**
 * Main polling loop
 */
async function main() {
  db.initDb();
  console.log('[worker] DB initialized.');

  const config = db.getConfig();

  console.log('[worker] Starting polling loop. Press Ctrl+C to stop.\n');
  console.log('[worker] Configuration:', config);

  while (true) {
    const now = Date.now();

    // Refresh politics market list periodically
    if (now - lastMarketRefresh > config.marketRefreshMinutes * 60 * 1000) {
      console.log('[worker] Refreshing politics markets...');
      await refreshMarkets();
    }

    if (marketIndex.size === 0) {
      console.log('[worker] No markets loaded yet, waiting...');
      await sleep(config.pollIntervalSeconds * 1000);
      continue;
    }

    // Fetch trades filtered to our tracked politics markets
    const rawTrades = await polymarket.fetchMarketTrades(config.tradesPerFetch);
    let newCount = 0;

    for (const raw of rawTrades) {
      const conditionId = raw.conditionId;
      if (!conditionId || !marketIndex.has(conditionId)) {
        continue;
      }

      const market = marketIndex.get(conditionId)!;
      const trade = polymarket.normalizeTrade(raw, market.id);

      if (!trade.id || trade.size <= 0) {
        continue;
      }

      if (db.tradeExists(trade.id)) {
        continue;
      }

      newCount++;

      // Look up wallet profile (cached in DB; fetch from API on first sight)
      const walletAddress = trade.maker;
      let walletData = null;

      if (walletAddress) {
        walletData = db.getWallet(walletAddress);
        if (!walletData) {
          const profile = await polymarket.fetchWalletProfile(walletAddress);
          if (profile) {
            db.upsertWallet(
              walletAddress,
              profile.firstTradeTs ?? null,
              profile.tradeCount ?? 0,
              Math.floor(Date.now() / 1000)
            );
            walletData = profile as any;
          }
        }
      }

      // Score the trade
      const { score, signals } = scoreTrade(trade, market, walletData, config);
      trade.suspicionScore = score;

      // Insert trade into database
      db.insertTrade(trade);

      // Fire alert if suspicious
      if (isSuspicious(score, config) && !db.alertExists(trade.id)) {
        const alert = {
          tradeId: trade.id,
          marketId: market.id,
          question: market.question,
          score,
          signals: signals.map((s: SuspicionSignal) => s.description),
          firedAt: new Date().toISOString(),
        };

        db.insertAlert(alert);
        console.log('\n' + '='.repeat(60));
        console.log('  *** SUSPICIOUS TRADE DETECTED ***');
        console.log('='.repeat(60));
        console.log(`  Market:   ${market.question}`);
        console.log(`  Score:    ${score.toFixed(2)}  (threshold: ${config.suspicionThreshold})`);
        for (const sig of signals) {
          console.log(`  Signal:   ${sig.description}`);
        }
        const valueUsd = trade.size * trade.price;
        console.log(`  Size:     ${trade.size.toFixed(2)} shares  (~$${valueUsd.toFixed(2)})`);
        console.log(`  Price:    ${trade.side.toUpperCase()} @ ${trade.price.toFixed(3)}`);
        console.log(`  Wallet:   ${trade.maker || 'unknown'}`);
        console.log(`  Time:     ${trade.timestamp}`);
        console.log(`  URL:      https://polymarket.com/event/${market.slug}`);
        console.log('='.repeat(60) + '\n');

        // Add to watchlist
        if (walletAddress) {
          db.upsertWatchlist(walletAddress, trade.timestamp);
        }
      }
    }

    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(
      `[worker] ${timestamp} UTC — fetched ${rawTrades.length} trades, ${newCount} new politics trades. ` +
        `Sleeping ${config.pollIntervalSeconds}s...`
    );

    await sleep(config.pollIntervalSeconds * 1000);
  }
}

/**
 * Refresh markets from Polymarket API
 */
async function refreshMarkets() {
  const freshMarkets = await polymarket.fetchPoliticsMarkets();

  for (const market of freshMarkets) {
    db.upsertMarket(market);
  }

  const allMarkets = db.getAllMarkets();
  marketIndex = new Map(allMarkets.map((m) => [m.id, m]));
  lastMarketRefresh = Date.now();

  console.log(`[worker] Tracking ${marketIndex.size} politics markets.`);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the worker
if (require.main === module) {
  main().catch((error) => {
    console.error('[worker] Fatal error:', error);
    process.exit(1);
  });
}
