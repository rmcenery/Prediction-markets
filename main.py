import time
import json
from datetime import datetime, timezone

import db
import api
import detector
import alerts
from config import POLL_INTERVAL_SECONDS, MARKET_REFRESH_MINUTES


def main():
    db.init_db()
    print("[tracker] DB initialized.")

    # Maps conditionId -> market dict for O(1) lookup during filtering
    market_index: dict[str, dict] = {}
    last_market_refresh = 0.0

    print("[tracker] Starting polling loop. Press Ctrl+C to stop.\n")

    while True:
        now = time.time()

        # Refresh politics market list periodically
        if now - last_market_refresh > MARKET_REFRESH_MINUTES * 60:
            print("[tracker] Refreshing politics markets...")
            fresh = api.fetch_politics_markets()
            for m in fresh:
                db.upsert_market(m)
            all_markets = db.get_all_markets()
            market_index = {m["id"]: m for m in all_markets}
            last_market_refresh = now
            print(f"[tracker] Tracking {len(market_index)} politics markets.")

        if not market_index:
            print("[tracker] No markets loaded yet, waiting...")
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        # Fetch trades filtered to our tracked politics markets
        condition_ids = list(market_index.keys())
        raw_trades = api.fetch_market_trades(condition_ids)
        new_count = 0

        for raw in raw_trades:
            condition_id = raw.get("conditionId", "")
            if condition_id not in market_index:
                continue

            market = market_index[condition_id]
            trade = api.normalize_trade(raw, market["id"])

            if not trade["id"] or trade["size"] <= 0:
                continue

            if db.trade_exists(trade["id"]):
                continue

            new_count += 1

            # Look up wallet profile (cached in DB; fetch from API on first sight)
            wallet_address = trade["maker"]
            wallet_data = None
            if wallet_address:
                wallet_data = db.get_wallet(wallet_address)
                if wallet_data is None:
                    profile = api.fetch_wallet_profile(wallet_address)
                    if profile:
                        db.upsert_wallet(
                            wallet_address,
                            profile["first_trade_ts"],
                            profile["trade_count"],
                            int(time.time()),
                        )
                        wallet_data = profile

            score, signals = detector.score_trade(trade, market, wallet_data)
            trade["suspicion_score"] = score

            db.insert_trade(trade)

            if detector.is_suspicious(score) and not db.alert_exists(trade["id"]):
                alerts.fire_alert(trade, market, score, signals)

                db.insert_alert({
                    "trade_id": trade["id"],
                    "market_id": market["id"],
                    "question": market["question"],
                    "score": score,
                    "signals": json.dumps(signals),
                    "fired_at": datetime.now(timezone.utc).isoformat(),
                })

                wallet = trade["maker"]
                if wallet:
                    db.upsert_watchlist(wallet, trade["timestamp"])

        print(
            f"[tracker] {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')} "
            f"— fetched {len(raw_trades)} trades, {new_count} new politics trades. "
            f"Sleeping {POLL_INTERVAL_SECONDS}s..."
        )
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[tracker] Stopped.")
