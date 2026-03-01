import math
import statistics
from datetime import datetime, timezone
from config import (
    Z_SCORE_THRESHOLD,
    VOLUME_PCT_THRESHOLD,
    PRE_RESOLUTION_HOURS,
    SUSPICION_THRESHOLD,
    ROLLING_WINDOW,
)
from db import get_recent_trade_sizes


def score_trade(trade: dict, market: dict, wallet: dict = None) -> tuple:
    """
    Returns (suspicion_score, [list of signal descriptions]).
    Score > SUSPICION_THRESHOLD means fire an alert.
    wallet: optional dict with first_trade_ts and trade_count from DB cache.
    """
    signals = []
    large_score = _large_trade_score(trade, market, signals)
    timing_multiplier = _timing_multiplier(trade, market, signals)
    wallet_multiplier = _wallet_multiplier(wallet, trade["timestamp"], signals)

    score = large_score * timing_multiplier * wallet_multiplier

    return score, signals


def _large_trade_score(trade: dict, market: dict, signals: list) -> float:
    """
    Returns a score >= 1.0 if the trade is unusually large, else 0.0.
    Checks two sub-signals: Z-score vs rolling history, and % of 24h volume.
    """
    size = trade["size"]
    if size <= 0:
        return 0.0

    # --- Z-score against rolling window ---
    recent_sizes = get_recent_trade_sizes(trade["market_id"], ROLLING_WINDOW)
    z_score_hit = False
    if len(recent_sizes) >= 10:
        mean = statistics.mean(recent_sizes)
        stdev = statistics.stdev(recent_sizes) if len(recent_sizes) > 1 else 0
        if stdev > 0:
            z = (size - mean) / stdev
            if z >= Z_SCORE_THRESHOLD:
                z_score_hit = True
                signals.append(f"Large position ({z:.1f}x sigma above avg size of ${mean:,.0f})")

    # --- % of 24h volume ---
    vol_pct_hit = False
    volume_24h = market.get("volume_24h", 0)
    if volume_24h > 0:
        pct = (size / volume_24h) * 100
        if pct >= VOLUME_PCT_THRESHOLD:
            vol_pct_hit = True
            signals.append(f"Trade is {pct:.1f}% of 24h market volume (${volume_24h:,.0f})")

    if z_score_hit or vol_pct_hit:
        return 1.0
    return 0.0


def _timing_multiplier(trade: dict, market: dict, signals: list) -> float:
    """
    Returns a multiplier based on proximity to market resolution.
    1.0 = no timing signal; higher = closer to end date.
    """
    end_date_str = market.get("end_date", "")
    if not end_date_str:
        return 1.0

    try:
        end_dt = _parse_iso(end_date_str)
    except (ValueError, TypeError):
        return 1.0

    try:
        trade_dt = _parse_iso(trade["timestamp"])
    except (ValueError, TypeError):
        return 1.0

    hours_remaining = (end_dt - trade_dt).total_seconds() / 3600

    if hours_remaining < 0:
        # Market already resolved, skip timing signal
        return 1.0

    if hours_remaining <= PRE_RESOLUTION_HOURS:
        # Score scales from 1.5 (at 48h) up to 3.0 (at 0h)
        multiplier = 1.5 + 1.5 * (1 - hours_remaining / PRE_RESOLUTION_HOURS)
        signals.append(
            f"Pre-resolution: {hours_remaining:.1f}h before market closes"
        )
        return multiplier

    return 1.0


def _wallet_multiplier(wallet: dict, trade_ts: str, signals: list) -> float:
    """
    Boosts score for wallets that are new or have very few trades.
    Returns 1.0 if no wallet data available (neutral — don't penalize missing data).
    """
    if not wallet:
        return 1.0

    trade_count = wallet.get("trade_count") or 0
    first_trade_ts = wallet.get("first_trade_ts")

    boost = 1.0

    # Very inexperienced wallet
    if trade_count < 5:
        boost = max(boost, 2.0)
        signals.append(f"Fresh wallet: only {trade_count} total trades on Polymarket")
    elif trade_count < 20:
        boost = max(boost, 1.5)
        signals.append(f"New wallet: only {trade_count} total trades on Polymarket")

    # Young account by age
    if first_trade_ts:
        try:
            trade_dt = _parse_iso(trade_ts)
            account_age_days = (trade_dt.timestamp() - first_trade_ts) / 86400
            if account_age_days < 7:
                boost = max(boost, 2.0)
                signals.append(f"New account: first trade was {account_age_days:.1f} days ago")
            elif account_age_days < 30:
                boost = max(boost, 1.3)
                signals.append(f"Young account: first trade was {account_age_days:.0f} days ago")
        except (ValueError, TypeError):
            pass

    return boost


def is_suspicious(score: float) -> bool:
    return score >= SUSPICION_THRESHOLD


def _parse_iso(s: str) -> datetime:
    """Parse ISO 8601 / Unix timestamp string to aware UTC datetime."""
    s = str(s).strip()
    # Handle Unix timestamps (seconds or milliseconds)
    if s.isdigit():
        ts = int(s)
        if ts > 1e12:
            ts //= 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    # Handle ISO strings
    s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)
