import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import * as db from './db';
import { WSEvent, PaginatedResponse } from '../shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
db.initDb();

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
export const wss = new WebSocketServer({ server });

const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('[ws] Client connected');
  connectedClients.add(ws);

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[ws] WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

/**
 * Broadcast event to all connected WebSocket clients
 */
export function broadcastEvent(event: WSEvent): void {
  const message = JSON.stringify(event);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ========== API Routes ==========

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all markets
app.get('/api/markets', (_req: Request, res: Response) => {
  try {
    const markets = db.getAllMarkets();
    res.json(markets);
  } catch (error) {
    console.error('[api] Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Get market by ID
app.get('/api/markets/:id', (req: Request, res: Response) => {
  try {
    const market = db.getMarketById(req.params.id);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    return res.json(market);
  } catch (error) {
    console.error('[api] Error fetching market:', error);
    return res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// Get trades (paginated)
app.get('/api/trades', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
    const offset = (page - 1) * pageSize;

    const trades = db.getAllTrades(pageSize, offset);
    const total = db.getTradesCount();

    const response: PaginatedResponse<typeof trades[0]> = {
      data: trades,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    res.json(response);
  } catch (error) {
    console.error('[api] Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get trade by ID
app.get('/api/trades/:id', (req: Request, res: Response) => {
  try {
    const trade = db.getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    return res.json(trade);
  } catch (error) {
    console.error('[api] Error fetching trade:', error);
    return res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// Get alerts (paginated)
app.get('/api/alerts', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
    const offset = (page - 1) * pageSize;

    const alerts = db.getAllAlerts(pageSize, offset);
    const total = db.getAlertsCount();

    const response: PaginatedResponse<typeof alerts[0]> = {
      data: alerts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    res.json(response);
  } catch (error) {
    console.error('[api] Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alert by ID
app.get('/api/alerts/:id', (req: Request, res: Response) => {
  try {
    const alert = db.getAlertById(parseInt(req.params.id));
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    return res.json(alert);
  } catch (error) {
    console.error('[api] Error fetching alert:', error);
    return res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Get watchlist
app.get('/api/watchlist', (_req: Request, res: Response) => {
  try {
    const watchlist = db.getWatchlist();
    res.json(watchlist);
  } catch (error) {
    console.error('[api] Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add to watchlist
app.post('/api/watchlist', (req: Request, res: Response) => {
  try {
    const { address, notes } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    db.upsertWatchlist(address, new Date().toISOString(), notes);
    return res.json({ success: true });
  } catch (error) {
    console.error('[api] Error adding to watchlist:', error);
    return res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove from watchlist
app.delete('/api/watchlist/:address', (req: Request, res: Response) => {
  try {
    db.removeFromWatchlist(req.params.address);
    res.json({ success: true });
  } catch (error) {
    console.error('[api] Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Update watchlist notes
app.patch('/api/watchlist/:address', (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    db.updateWatchlistNotes(req.params.address, notes);
    res.json({ success: true });
  } catch (error) {
    console.error('[api] Error updating watchlist:', error);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Get wallet profile
app.get('/api/wallets/:address', (req: Request, res: Response) => {
  try {
    const wallet = db.getWallet(req.params.address);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    return res.json(wallet);
  } catch (error) {
    console.error('[api] Error fetching wallet:', error);
    return res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Get config
app.get('/api/config', (_req: Request, res: Response) => {
  try {
    const config = db.getConfig();
    res.json(config);
  } catch (error) {
    console.error('[api] Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Update config
app.put('/api/config', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'number') {
        db.updateConfig(key as any, value);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[api] Error updating config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Get dashboard stats
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const alertsToday = db.getAlertsByDateRange(today, now.toISOString());
    const alertsWeek = db.getAlertsByDateRange(weekAgo, now.toISOString());
    const alertsMonth = db.getAlertsByDateRange(monthAgo, now.toISOString());

    const stats = {
      totalAlerts: db.getAlertsCount(),
      alertsToday: alertsToday.length,
      alertsThisWeek: alertsWeek.length,
      alertsThisMonth: alertsMonth.length,
      marketsTracked: db.getAllMarkets().length,
      watchlistCount: db.getWatchlist().length,
      totalTrades: db.getTradesCount(),
    };

    res.json(stats);
  } catch (error) {
    console.error('[api] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`);
  console.log(`[server] WebSocket server ready`);
});

export default app;
