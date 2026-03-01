# Deployment Guide - Polymarket Tracker

This guide will help you deploy the Polymarket Tracker locally with Docker and expose it to the internet via Cloudflare Tunnel.

## Prerequisites

- Docker and Docker Compose installed
- (Optional) Cloudflare account for internet access

## Quick Start - Local Access Only

### 1. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 2. Access Your Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 3. Stop Services

```bash
docker-compose down
```

---

## Internet Access via Cloudflare Tunnel

Cloudflare Tunnel provides secure, encrypted access to your local app without:
- ❌ Port forwarding
- ❌ Exposing your home IP
- ❌ Opening firewall ports
- ✅ Built-in DDoS protection
- ✅ Free SSL/TLS certificates
- ✅ Zero Trust security

### Setup Cloudflare Tunnel

#### 1. Create Cloudflare Account

Go to https://dash.cloudflare.com/ and sign up (free tier works!)

#### 2. Create a Tunnel

1. Navigate to **Zero Trust** → **Access** → **Tunnels**
2. Click **Create a tunnel**
3. Choose **Cloudflared**
4. Name it: `polymarket-tracker`
5. Copy the **tunnel token** (looks like: `eyJhIjoiXXXXX...`)

#### 3. Configure Environment

```bash
# Create .env file
cp .env.example .env

# Edit .env and add your tunnel token
nano .env
```

Add your token:
```env
CLOUDFLARE_TUNNEL_TOKEN=your_actual_token_here
```

#### 4. Configure Tunnel Route

Back in Cloudflare dashboard:

1. **Public Hostname**:
   - Subdomain: `polymarket` (or whatever you want)
   - Domain: Select your domain
   - Service: `http://frontend:80`

2. Click **Save tunnel**

#### 5. Start with Tunnel

```bash
# Start all services including Cloudflare tunnel
docker-compose --profile tunnel up -d

# Check tunnel status
docker-compose logs cloudflared
```

You should see: `Connection established` in the logs

#### 6. Access from Internet

Your app is now available at: `https://polymarket.yourdomain.com`

---

## Docker Commands Cheat Sheet

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Start with tunnel
docker-compose --profile tunnel up -d

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f backend
docker-compose logs -f worker
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Check service status
docker-compose ps

# Execute command in container
docker-compose exec backend sh
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         Internet (Cloudflare Tunnel)        │
│         https://polymarket.yourdomain.com   │
└────────────────────┬────────────────────────┘
                     │ (encrypted tunnel)
                     │
┌────────────────────▼────────────────────────┐
│         Docker Network (polymarket)         │
│                                             │
│  ┌──────────────┐  ┌──────────────┐       │
│  │   Frontend   │  │   Backend    │       │
│  │   (Nginx)    │◄─┤   (Express)  │       │
│  │   Port 80    │  │   Port 3001  │       │
│  └──────────────┘  └───────┬──────┘       │
│                             │              │
│  ┌──────────────┐          │              │
│  │   Worker     │◄─────────┘              │
│  │  (Monitor)   │                         │
│  └──────────────┘                         │
│                                             │
│  ┌──────────────┐                          │
│  │   SQLite DB  │                          │
│  │  (Volume)    │                          │
│  └──────────────┘                          │
└─────────────────────────────────────────────┘
```

---

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DB_PATH` | Database path | `/app/data/tracker.db` |
| `PORT` | API port | `3001` |

### Cloudflare Tunnel

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel authentication token | Yes (for tunnel) |

---

## Data Persistence

The SQLite database is stored in a Docker volume mounted at `./backend/data`.

**Backup your database:**
```bash
# Copy from container
docker cp polymarket-backend:/app/data/tracker.db ./backup.db

# Or use volume directly
cp backend/data/tracker.db ./backup.db
```

**Restore database:**
```bash
cp ./backup.db backend/data/tracker.db
docker-compose restart backend worker
```

---

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Frontend health
curl http://localhost:8080
```

### View Stats

```bash
# Current statistics
curl http://localhost:3001/api/stats | jq

# Recent alerts
curl http://localhost:3001/api/alerts | jq
```

### Docker Stats

```bash
# Resource usage
docker stats polymarket-backend polymarket-worker polymarket-frontend
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database locked error

```bash
# Stop all services
docker-compose down

# Remove lock files
rm backend/data/*.db-shm backend/data/*.db-wal

# Restart
docker-compose up -d
```

### Cloudflare tunnel not connecting

```bash
# Verify token
echo $CLOUDFLARE_TUNNEL_TOKEN

# Check cloudflared logs
docker-compose logs cloudflared

# Restart tunnel
docker-compose restart cloudflared
```

### Frontend can't connect to backend

```bash
# Check network
docker network inspect polymarket_polymarket-network

# Verify backend is healthy
docker-compose ps
curl http://localhost:3001/health
```

---

## Security Best Practices

1. **Keep tunnel token secret** - Don't commit `.env` to git
2. **Use Cloudflare Access** - Add authentication to your tunnel
3. **Regular updates** - Keep Docker images updated
4. **Monitor logs** - Watch for suspicious activity
5. **Backup database** - Regular backups of tracker.db
6. **Limit resources** - Set Docker resource limits in production

---

## Production Optimizations

### Add resource limits to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Enable automatic restarts:

All services already have `restart: unless-stopped`

### Add log rotation:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Next Steps

1. ✅ Deploy with Docker
2. ✅ Set up Cloudflare Tunnel
3. 🔄 Configure custom domain
4. 🔄 Add authentication (Cloudflare Access)
5. 🔄 Set up monitoring (Prometheus/Grafana)
6. 🔄 Configure alerts (Discord/Slack/Email)

---

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Verify health: `curl http://localhost:3001/health`
- Rebuild: `docker-compose up -d --build`

Your Polymarket Tracker is now production-ready! 🚀
