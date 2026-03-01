# Polymarket Suspicious Trade Tracker - Development Plan

## Project Overview
Migrate existing Python Polymarket tracker to a modern web application with TypeScript backend and React frontend, maintaining all detection logic while adding real-time UI visualization.

## Current State Analysis
**Existing Python Implementation:**
- ✅ Polymarket API integration (Gamma API for markets, Data API for trades)
- ✅ SQLite database (markets, trades, alerts, watchlist, wallets)
- ✅ Sophisticated suspicious trade detection:
  - Z-score analysis (statistical outliers)
  - Volume % threshold (large trades relative to 24h volume)
  - Timing analysis (pre-resolution trades)
  - Wallet age/experience scoring
- ✅ Alert system with console output
- ✅ Wallet profile caching
- ✅ Rolling window analysis (200 trades)

## Technology Stack

### Backend
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** SQLite (migrate existing schema) + better-sqlite3
- **API Client:** axios for Polymarket APIs
- **WebSocket:** ws for real-time updates
- **Process Manager:** PM2 (for background polling)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Components:** shadcn/ui (Tailwind CSS based)
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6
- **WebSocket Client:** native WebSocket API
- **Charts:** Recharts (for visualizing trade data)

### DevOps
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Caddy (for SSL + tunneling)
- **Deployment:** Local hosting + Cloudflare Tunnel

---

## Development Phases

### Phase 1: Project Structure & Backend Foundation ✓
**Goal:** Set up monorepo structure and backend API server

1. **Project Structure**
   ```
   /backend
     /src
       /api         - REST API routes
       /services    - Business logic (detector, polymarket client)
       /db          - Database models and queries
       /types       - TypeScript interfaces
       /utils       - Helper functions
       server.ts    - Express server + WebSocket
       worker.ts    - Background polling worker
     package.json
     tsconfig.json

   /frontend
     /src
       /components  - React components
         /ui        - shadcn/ui components
       /hooks       - Custom React hooks
       /lib         - Utilities
       /pages       - Route pages
       /types       - TypeScript interfaces
       App.tsx
       main.tsx
     package.json
     vite.config.ts
     tailwind.config.js

   /shared
     /types         - Shared TypeScript types

   docker-compose.yml
   ```

2. **Backend Setup**
   - Initialize TypeScript Node.js project
   - Set up Express server with CORS
   - Configure better-sqlite3 with TypeScript
   - Create database schema (migrate from Python version)
   - Implement database models and queries

3. **Core Services**
   - Port `api.py` → `PolymarketClient.ts`
     - Markets fetcher
     - Trades fetcher
     - Wallet profile fetcher
   - Port `detector.py` → `SuspicionDetector.ts`
     - Large trade scoring
     - Timing multiplier
     - Wallet multiplier
     - Signal generation
   - Port `db.py` → Database service with TypeScript types

### Phase 2: REST API Implementation
**Goal:** Create REST endpoints for frontend consumption

**Endpoints:**
- `GET /api/markets` - List all tracked markets
- `GET /api/markets/:id` - Get market details
- `GET /api/trades` - List trades (paginated, filterable)
- `GET /api/trades/:id` - Get trade details
- `GET /api/alerts` - List alerts (paginated, filterable)
- `GET /api/alerts/:id` - Get alert details
- `GET /api/watchlist` - Get watchlist entries
- `POST /api/watchlist` - Add wallet to watchlist
- `DELETE /api/watchlist/:address` - Remove from watchlist
- `GET /api/stats` - Dashboard statistics
- `GET /api/wallets/:address` - Get wallet profile
- `GET /api/config` - Get detection thresholds
- `PUT /api/config` - Update detection thresholds

### Phase 3: Background Worker
**Goal:** Port main polling loop to TypeScript worker

1. **Worker Implementation**
   - Port `main.py` → `worker.ts`
   - Market refresh logic (every 10 minutes)
   - Trade polling loop (configurable interval)
   - Alert firing system
   - Wallet profile caching

2. **Worker Communication**
   - Emit events via WebSocket when:
     - New suspicious trade detected
     - Alert fired
     - New market added
   - Health check endpoint

### Phase 4: WebSocket Real-time Updates
**Goal:** Push live updates to frontend

**Events:**
- `trade:new` - New trade detected
- `alert:fired` - Suspicious trade alert
- `market:updated` - Market data refreshed
- `stats:updated` - Dashboard stats changed

### Phase 5: Frontend Foundation
**Goal:** Set up React app with routing and UI framework

1. **Project Setup**
   - Initialize Vite + React + TypeScript
   - Install and configure shadcn/ui
   - Set up Tailwind CSS
   - Configure routing

2. **Core Layout**
   - Main navigation
   - Responsive sidebar
   - Header with stats
   - Footer

3. **shadcn/ui Components Install**
   - Table
   - Card
   - Badge
   - Button
   - Dialog
   - Tabs
   - Select
   - Input
   - Toast
   - Alert
   - Skeleton (loading states)

### Phase 6: Frontend Pages Implementation
**Goal:** Build all UI pages with real-time updates

**Pages:**

1. **Dashboard** (`/`)
   - Real-time stats cards:
     - Total alerts (today/week/month)
     - Markets tracked
     - Active trades monitored
     - Watchlist count
   - Recent alerts table (live updates)
   - Top suspicious wallets
   - Detection threshold settings

2. **Markets** (`/markets`)
   - Searchable/filterable table
   - Columns: Question, Volume 24h, End Date, Status
   - Click to view market details
   - Real-time volume updates

3. **Market Details** (`/markets/:id`)
   - Market info card
   - Recent trades chart (Recharts)
   - Trade history table
   - Suspicious trades highlighted
   - Alert history for this market

4. **Alerts** (`/alerts`)
   - Filterable alert feed
   - Score-based color coding
   - Signal badges
   - Link to market and wallet
   - Real-time new alerts
   - Toast notifications

5. **Alert Details** (`/alerts/:id`)
   - Full alert details
   - Trade breakdown
   - All signals explained
   - Market context
   - Wallet investigation panel

6. **Watchlist** (`/watchlist`)
   - Wallet addresses table
   - Alert count per wallet
   - First seen date
   - Notes field (editable)
   - Recent activity
   - Add/remove functionality

7. **Settings** (`/settings`)
   - Detection threshold sliders:
     - Z-score threshold
     - Volume % threshold
     - Pre-resolution hours
     - Suspicion score threshold
   - Polling interval
   - Alert preferences
   - Export/import config

### Phase 7: Real-time Features
**Goal:** Implement WebSocket client and live updates

1. **WebSocket Hook**
   - Custom `useWebSocket` hook
   - Auto-reconnect logic
   - Event subscription system

2. **Live Data Updates**
   - React Query integration
   - Optimistic updates
   - Cache invalidation on WebSocket events
   - Toast notifications for new alerts

### Phase 8: Data Visualization
**Goal:** Add charts and analytics

1. **Charts (using Recharts)**
   - Alert frequency timeline
   - Trade volume over time
   - Suspicion score distribution
   - Top markets by alerts
   - Wallet activity heatmap

2. **Analytics Dashboard**
   - Trend analysis
   - Pattern detection insights
   - Market risk indicators

### Phase 9: Docker & Deployment
**Goal:** Containerize and deploy securely

1. **Docker Setup**
   ```yaml
   services:
     backend:
       build: ./backend
       ports: ["3001:3001"]
       volumes: ["./data:/app/data"]

     frontend:
       build: ./frontend
       ports: ["5173:5173"]

     caddy:
       image: caddy:latest
       ports: ["80:80", "443:443"]
   ```

2. **Cloudflare Tunnel**
   - Set up tunnel for secure public access
   - No port forwarding needed
   - Built-in DDoS protection

3. **Environment Configuration**
   - `.env` files for config
   - Secrets management
   - Production vs development modes

### Phase 10: Testing & Polish
**Goal:** Ensure reliability and UX

1. **Backend Tests**
   - API endpoint tests
   - Detector logic tests
   - Database query tests

2. **Frontend Polish**
   - Loading states
   - Error boundaries
   - Empty states
   - Responsive design
   - Dark mode support
   - Accessibility (a11y)

3. **Documentation**
   - README with setup instructions
   - API documentation
   - Architecture diagram
   - Detection logic explanation

---

## Key Features to Implement

### Detection Algorithm (maintain from Python)
- ✅ Z-score analysis against rolling window
- ✅ Volume percentage threshold
- ✅ Pre-resolution timing boost
- ✅ Wallet age/experience multiplier
- ✅ Composite suspicion scoring

### New Features to Add
- 🔄 Real-time dashboard with WebSocket
- 🔔 Browser notifications for alerts
- 📊 Data visualization and charts
- 🔍 Advanced filtering and search
- 📝 Editable watchlist notes
- ⚙️ Configurable detection thresholds
- 📱 Responsive mobile design
- 🌙 Dark mode
- 📤 Export alerts to CSV/JSON
- 🔗 Direct links to Polymarket markets
- 📈 Historical analytics

---

## Database Schema (SQLite)

```sql
-- Markets table
CREATE TABLE markets (
    id TEXT PRIMARY KEY,              -- conditionId
    question TEXT NOT NULL,
    end_date TEXT,                    -- ISO timestamp
    token_ids TEXT,                   -- JSON array
    slug TEXT,
    volume_24h REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Trades table
CREATE TABLE trades (
    id TEXT PRIMARY KEY,              -- transactionHash
    market_id TEXT NOT NULL,
    token_id TEXT,
    size REAL NOT NULL,
    price REAL NOT NULL,
    side TEXT,                        -- 'buy' or 'sell'
    maker TEXT,                       -- wallet address
    taker TEXT,                       -- wallet address
    timestamp TEXT NOT NULL,
    suspicion_score REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Alerts table
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id TEXT UNIQUE NOT NULL,
    market_id TEXT NOT NULL,
    question TEXT NOT NULL,
    score REAL NOT NULL,
    signals TEXT NOT NULL,            -- JSON array
    fired_at TEXT NOT NULL,
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Watchlist table
CREATE TABLE watchlist (
    address TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL,
    alert_count INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table (cache)
CREATE TABLE wallets (
    address TEXT PRIMARY KEY,
    first_trade_ts INTEGER,           -- Unix timestamp
    trade_count INTEGER,
    fetched_at INTEGER NOT NULL,      -- Unix timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Config table (new)
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Configuration Values

```typescript
interface DetectionConfig {
  zScoreThreshold: number;          // default: 1.0
  volumePctThreshold: number;       // default: 5.0
  preResolutionHours: number;       // default: 48
  suspicionThreshold: number;       // default: 1.5
  rollingWindow: number;            // default: 200
  pollIntervalSeconds: number;      // default: 1
  marketRefreshMinutes: number;     // default: 10
  tradesPerFetch: number;          // default: 10000
}
```

---

## API Integration

### Polymarket APIs
- **Gamma API:** `https://gamma-api.polymarket.com`
  - `/events` - Fetch politics markets (tag_id=2)
- **Data API:** `https://data-api.polymarket.com`
  - `/trades` - Fetch recent trades
  - `/trades?user={address}` - Fetch wallet history

---

## Security Considerations

1. **API Rate Limiting**
   - Implement exponential backoff
   - Cache responses when possible

2. **Input Validation**
   - Sanitize all user inputs
   - Validate wallet addresses
   - Prevent SQL injection

3. **CORS Configuration**
   - Whitelist frontend origin only

4. **Environment Secrets**
   - Never commit API keys
   - Use `.env` files
   - Secure database file permissions

5. **Docker Isolation**
   - Run services in separate containers
   - Limit container resources
   - Use non-root users

---

## Success Metrics

- ✅ All Python detection logic successfully ported
- ✅ Real-time updates working (<1s latency)
- ✅ Responsive UI on mobile and desktop
- ✅ Docker deployment successful
- ✅ Cloudflare Tunnel configured
- ✅ Zero downtime during normal operation
- ✅ Sub-100ms API response times

---

## Timeline Estimate

- **Phase 1-3:** Backend (2-3 days)
- **Phase 4:** WebSocket (1 day)
- **Phase 5-6:** Frontend pages (3-4 days)
- **Phase 7:** Real-time features (1-2 days)
- **Phase 8:** Visualization (1-2 days)
- **Phase 9:** Docker/Deploy (1 day)
- **Phase 10:** Testing/Polish (1-2 days)

**Total: ~10-15 days of development**

---

## Current Status: READY TO START
**Next Step:** Phase 1 - Backend Foundation
