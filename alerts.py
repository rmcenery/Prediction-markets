from datetime import datetime, timezone


def fire_alert(trade: dict, market: dict, score: float, signals: list):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    slug = market.get("slug", "")
    url = f"https://polymarket.com/event/{slug}" if slug else "N/A"

    maker = trade.get("maker") or "unknown"
    taker = trade.get("taker") or "unknown"
    wallet = maker if maker != "unknown" else taker

    value_usd = trade["size"] * trade["price"]

    print("\n" + "=" * 60)
    print("  *** SUSPICIOUS TRADE DETECTED ***")
    print("=" * 60)
    print(f"  Market:   {market.get('question', 'N/A')}")
    print(f"  Score:    {score:.2f}  (threshold: 1.5)")
    for sig in signals:
        print(f"  Signal:   {sig}")
    print(f"  Size:     {trade['size']:,.2f} shares  (~${value_usd:,.2f})")
    print(f"  Price:    {trade['side'].upper()} @ {trade['price']:.3f}")
    print(f"  Wallet:   {wallet}")
    print(f"  Time:     {trade['timestamp']}")
    print(f"  URL:      {url}")
    print("=" * 60 + "\n")
