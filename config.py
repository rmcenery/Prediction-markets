# Detection thresholds
Z_SCORE_THRESHOLD = 1.0       # std devs above rolling mean to flag a trade
VOLUME_PCT_THRESHOLD = 5.0    # % of market's 24h volume that triggers flag
PRE_RESOLUTION_HOURS = 48     # hours before end_date that counts as "pre-resolution"
SUSPICION_THRESHOLD = 1.5     # combined score needed to fire an alert
ROLLING_WINDOW = 200          # number of recent trades used to compute baseline

# Polling
POLL_INTERVAL_SECONDS = 1
MARKET_REFRESH_MINUTES = 10

# API
GAMMA_BASE = "https://gamma-api.polymarket.com"
DATA_BASE = "https://data-api.polymarket.com"
TRADES_PER_FETCH = 10000     # trades per fetch (data API supports up to 10,000)

# DB
DB_PATH = "tracker.db"
