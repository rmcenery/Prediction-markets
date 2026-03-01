# Polymarket Tracker Backend

TypeScript backend service for monitoring suspicious trades on Polymarket.

## Features

- **Real-time Trade Monitoring**: Continuously polls Polymarket API for new trades
- **Suspicious Trade Detection**: Multi-factor scoring system including:
  - Statistical outlier detection (Z-score analysis)
  - Large volume percentage detection
  - Pre-resolution timing analysis
  - Wallet age and experience scoring
- **REST API**: Full-featured API for frontend consumption
- **WebSocket Support**: Real-time updates via WebSocket
- **SQLite Database**: Lightweight, file-based storage
- **Wallet Profiling**: Automatic caching of wallet data

## Prerequisites

- Node.js >= 18.0.0 (recommended: v22 or v24)
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Default configuration:
- `PORT=3001` - API server port
- `DB_PATH=./data/tracker.db` - Database file location

## Running

### Development Mode

Start the API server:
```bash
npm run dev
```

Start the background worker (in a separate terminal):
```bash
npm run worker
```

### Production Mode

Build the project:
```bash
npm run build
```

Start services:
```bash
npm start              # API server
npm run start:worker   # Background worker
```

## API Endpoints

### Markets
- `GET /api/markets` - List all tracked markets
- `GET /api/markets/:id` - Get market by ID

### Trades
- `GET /api/trades?page=1&pageSize=50` - List trades (paginated)
- `GET /api/trades/:id` - Get trade by ID

### Alerts
- `GET /api/alerts?page=1&pageSize=50` - List alerts (paginated)
- `GET /api/alerts/:id` - Get alert by ID

### Watchlist
- `GET /api/watchlist` - Get watchlist
- `POST /api/watchlist` - Add to watchlist
  ```json
  { "address": "0x...", "notes": "Optional notes" }
  ```
- `DELETE /api/watchlist/:address` - Remove from watchlist
- `PATCH /api/watchlist/:address` - Update notes
  ```json
  { "notes": "Updated notes" }
  ```

### Wallets
- `GET /api/wallets/:address` - Get wallet profile

### Configuration
- `GET /api/config` - Get detection configuration
- `PUT /api/config` - Update configuration
  ```json
  {
    "zScoreThreshold": 1.0,
    "volumePctThreshold": 5.0,
    "suspicionThreshold": 1.5
  }
  ```

### Stats
- `GET /api/stats` - Dashboard statistics

### Health
- `GET /health` - Health check

## WebSocket Events

Connect to `ws://localhost:3001` to receive real-time updates:

- `trade:new` - New trade detected
- `alert:fired` - Suspicious trade alert
- `market:updated` - Market data refreshed
- `stats:updated` - Dashboard stats changed

## Detection Algorithm

The suspicion score is calculated using:

```
score = largeScore × timingMultiplier × walletMultiplier
```

Where:
- **largeScore** (0 or 1): Triggered if trade is a statistical outlier OR > 5% of 24h volume
- **timingMultiplier** (1.0-3.0): Increases for trades near market resolution
- **walletMultiplier** (1.0-2.0): Increases for new/inexperienced wallets

Alerts fire when `score >= suspicionThreshold` (default: 1.5)

## Architecture

```
backend/
├── src/
│   ├── api/              # Future: API route modules
│   ├── services/
│   │   ├── polymarket-client.ts  # Polymarket API client
│   │   └── detector.ts           # Suspicious trade detection
│   ├── db/
│   │   └── index.ts              # Database operations
│   ├── types/                    # TypeScript types
│   ├── server.ts                 # Express API server + WebSocket
│   └── worker.ts                 # Background polling worker
└── data/
    └── tracker.db                # SQLite database
```

## Development

Type-check without building:
```bash
npm run type-check
```

## Next Steps

- [ ] Implement frontend React app
- [ ] Add data visualization
- [ ] Docker deployment
- [ ] Cloudflare Tunnel setup
- [ ] Add tests
