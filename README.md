# Polymarket Suspicious Trade Tracker

A real-time monitoring system for detecting suspicious trading activity on Polymarket prediction markets.

## Project Status

### ✅ Completed: Backend (TypeScript)
- REST API server with Express
- WebSocket for real-time updates
- SQLite database with full schema
- Polymarket API integration
- Sophisticated trade scoring algorithm
- Wallet profiling and caching
- Background worker for continuous monitoring

### 🚧 In Progress: Frontend (React + TypeScript)
- React 18 with Vite
- shadcn/ui components
- Real-time dashboard
- Data visualization

### 📋 Planned
- Docker containerization
- Cloudflare Tunnel deployment
- Testing suite
- Documentation

## Quick Start

See detailed setup instructions in:
- [Backend README](./backend/README.md)
- [Development Plan](./PLAN.md)

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **APIs**: Polymarket Gamma API & Data API
- **WebSocket**: ws

### Frontend (Coming Soon)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State**: TanStack Query
- **Charts**: Recharts

## Features

### Detection Algorithm
- ✅ Statistical outlier detection (Z-score)
- ✅ Volume percentage analysis
- ✅ Pre-resolution timing alerts
- ✅ Wallet age/experience scoring
- ✅ Composite suspicion scoring

### Current Capabilities
- ✅ Monitor all Polymarket politics markets
- ✅ Real-time trade ingestion
- ✅ Automatic suspicious trade detection
- ✅ Wallet profiling and watchlist
- ✅ Alert system with console output
- ✅ REST API for data access
- ✅ WebSocket for live updates

### Coming Soon
- 🔄 Web dashboard with charts
- 🔄 Browser notifications
- 🔄 Advanced filtering and search
- 🔄 Configurable thresholds via UI
- 🔄 Export functionality
- 🔄 Dark mode

## Development

### Backend
```bash
cd backend
npm install
npm run dev          # Start API server
npm run worker       # Start background monitor (separate terminal)
```

### Frontend (Coming Soon)
```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  ┌──────────────────────────────────┐   │
│  │  Dashboard │ Alerts │ Markets    │   │
│  │  Watchlist │ Settings            │   │
│  └──────────────────────────────────┘   │
└────────────┬────────────────────────────┘
             │ REST + WebSocket
             │
┌────────────▼────────────────────────────┐
│      Backend (Node.js + TypeScript)     │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  API Server  │  │  Worker Process │  │
│  │  (Express)   │  │  (Polling Loop) │  │
│  └──────┬───────┘  └────────┬────────┘  │
│         │                   │           │
│  ┌──────▼──────────────────▼────────┐   │
│  │     SQLite Database             │   │
│  │  (Markets, Trades, Alerts, etc) │   │
│  └─────────────────────────────────┘   │
└────────────┬────────────────────────────┘
             │ HTTP API Calls
             │
┌────────────▼────────────────────────────┐
│         Polymarket APIs                 │
│  • Gamma API (Markets)                  │
│  • Data API (Trades)                    │
└─────────────────────────────────────────┘
```

## Detection Methodology

Trades are scored based on multiple risk factors:

1. **Size Analysis**
   - Z-score vs rolling 200-trade average
   - Percentage of 24h market volume

2. **Timing Analysis**
   - Proximity to market resolution
   - Multiplier increases as deadline approaches

3. **Wallet Analysis**
   - Account age (days since first trade)
   - Total trade count on platform

**Alert Threshold**: Score ≥ 1.5 triggers an alert

## API Integration

- **Gamma API**: Fetch politics markets (tag_id=2)
- **Data API**: Real-time trade stream
- **Rate Limiting**: Respects API limits with appropriate delays
- **Caching**: Wallet profiles cached in database

## Security & Deployment

Designed for secure local deployment with optional public access:

- **Docker**: Isolated container environment
- **Cloudflare Tunnel**: Secure public access without port forwarding
- **No sensitive data**: Only public blockchain/market data
- **SQLite**: No external database server required

## License

MIT

## Contributing

See [PLAN.md](./PLAN.md) for the development roadmap and current status.
