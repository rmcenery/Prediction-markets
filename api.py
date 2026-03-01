import requests
import json
from config import GAMMA_BASE, DATA_BASE, TRADES_PER_FETCH

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "polymarket-tracker/1.0"})


# --- Gamma API ---

def fetch_politics_markets() -> list[dict]:
    """
    Fetch active, unresolved politics markets using the /events endpoint.
    tag_id=2 = Politics. closed=false filters out resolved markets.
    """
    markets = []
    offset = 0
    limit = 100
    max_pages = 10

    for _ in range(max_pages):
        try:
            resp = SESSION.get(
                f"{GAMMA_BASE}/events",
                params={
                    "tag_id": 2,          # Politics category
                    "active": "true",
                    "closed": "false",    # Exclude resolved markets
                    "limit": limit,
                    "offset": offset,
                    "order": "volume24hr",
                    "ascending": "false",
                },
                timeout=10,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[api] Gamma fetch error: {e}")
            break

        batch = resp.json()
        if not batch:
            break

        # Each event contains a nested list of markets
        for event in batch:
            for m in (event.get("markets") or []):
                normalized = _normalize_market(m, event)
                if normalized["id"]:
                    markets.append(normalized)

        if len(batch) < limit:
            break
        offset += limit

    return markets


def _normalize_market(m: dict, event: dict) -> dict:
    raw_token_ids = m.get("clobTokenIds") or []
    if isinstance(raw_token_ids, str):
        try:
            raw_token_ids = json.loads(raw_token_ids)
        except json.JSONDecodeError:
            raw_token_ids = []

    return {
        "id": m.get("conditionId") or "",
        "question": m.get("question") or event.get("title") or "",
        "end_date": m.get("endDate") or event.get("endDate") or "",
        "token_ids": json.dumps(raw_token_ids),
        "slug": event.get("slug") or m.get("slug") or "",
        "volume_24h": float(m.get("volume24hr") or m.get("volume") or 0),
    }


# --- Data API ---

def fetch_market_trades(condition_ids: list) -> list[dict]:
    """
    Fetch the most recent global trades and return them.
    The market= filter causes URL-length issues with many IDs, so we
    pull globally and filter client-side in main.py by conditionId.
    """
    try:
        resp = SESSION.get(
            f"{DATA_BASE}/trades",
            params={"limit": TRADES_PER_FETCH},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[api] Data API fetch error: {e}")
        return []

    data = resp.json()
    return data if isinstance(data, list) else []


def fetch_wallet_profile(address: str) -> dict:
    """
    Fetch a wallet's full trade history to compute account age and trade count.
    Returns {first_trade_ts, trade_count} or None on failure.
    """
    try:
        resp = SESSION.get(
            f"{DATA_BASE}/trades",
            params={"user": address, "limit": 500},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[api] Wallet fetch error ({address[:8]}...): {e}")
        return None

    trades = resp.json()
    if not isinstance(trades, list) or not trades:
        return {"first_trade_ts": None, "trade_count": 0}

    timestamps = [int(t["timestamp"]) for t in trades if t.get("timestamp")]
    return {
        "first_trade_ts": min(timestamps) if timestamps else None,
        "trade_count": len(trades),  # capped at 500; treat 500 as "experienced"
    }


def normalize_trade(raw: dict, market_id: str) -> dict:
    """Convert a raw Data API trade into the shape stored in the trades table."""
    return {
        "id": raw.get("transactionHash") or "",
        "market_id": market_id,
        "token_id": raw.get("asset") or "",
        "size": float(raw.get("size") or 0),
        "price": float(raw.get("price") or 0),
        "side": raw.get("side", ""),
        "maker": raw.get("proxyWallet") or "",
        "taker": "",
        "timestamp": str(raw.get("timestamp") or ""),
        "suspicion_score": 0.0,
    }
