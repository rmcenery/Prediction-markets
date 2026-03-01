import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { formatDate, formatNumber, getScoreColor } from './lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

interface DashboardStats {
  totalAlerts: number
  alertsToday: number
  alertsThisWeek: number
  alertsThisMonth: number
  marketsTracked: number
  watchlistCount: number
  totalTrades: number
}

interface Alert {
  id: number
  tradeId: string
  marketId: string
  question: string
  score: number
  signals: string[]
  firedAt: string
}

function App() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/stats`)
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data)
        setConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend')
        setConnected(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Fetch recent alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/alerts?page=1&pageSize=10`)
        if (!response.ok) throw new Error('Failed to fetch alerts')
        const data = await response.json()
        setAlerts(data.data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
        setLoading(false)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.DEV ? 'ws://localhost:3001' : `${protocol}//${window.location.host}/ws`)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[ws] Connected to backend')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('[ws] Received:', message)

        if (message.type === 'alert:fired') {
          // Add new alert to the top of the list
          setAlerts((prev) => [message.data, ...prev].slice(0, 10))
        }

        if (message.type === 'stats:updated') {
          setStats(message.data)
        }
      } catch (err) {
        console.error('[ws] Parse error:', err)
      }
    }

    ws.onerror = (err) => {
      console.error('[ws] Error:', err)
      setConnected(false)
    }

    ws.onclose = () => {
      console.log('[ws] Disconnected')
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [])

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Loading...</div>
          <div className="text-muted-foreground">Connecting to Polymarket Tracker</div>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
            <CardDescription>Failed to connect to the backend</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-sm">
              Make sure the backend server is running on port 3001:
              <code className="block mt-2 bg-muted p-2 rounded text-xs">
                cd backend && npm run dev
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Polymarket Tracker</h1>
              <p className="text-sm text-muted-foreground">Suspicious Trade Detection System</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={connected ? "default" : "destructive"}>
                {connected ? '● Live' : '● Disconnected'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Alerts</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(stats?.totalAlerts || 0)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Alerts Today</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{formatNumber(stats?.alertsToday || 0)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Markets Tracked</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(stats?.marketsTracked || 0)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Watchlist</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(stats?.watchlistCount || 0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>
              Latest suspicious trades detected ({alerts.length} shown)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No alerts yet. Waiting for suspicious trades...
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${getScoreColor(alert.score)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">{alert.question}</h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(alert.firedAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        Score: {alert.score.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {alert.signals.map((signal, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default App
