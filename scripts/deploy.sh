#!/bin/bash
set -e

echo "🚀 Deploying Polymarket Tracker..."
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ Error: docker-compose.yml not found"
  echo "   Please run this script from the project root"
  exit 1
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build images
echo "🔨 Building Docker images..."
docker compose build

# Stop old containers
echo "🛑 Stopping old containers..."
docker compose down

# Start new containers
echo "▶️  Starting new containers..."
docker compose up -d

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be healthy..."
sleep 5

# Show status
echo ""
echo "📊 Container status:"
docker compose ps

echo ""
echo "🎯 Application URLs:"
echo "   Local:  http://localhost:8080"
echo "   API:    http://localhost:3001"
echo "   Health: http://localhost:3001/health"

# Check backend health
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo ""
  echo "✅ Deployment successful!"
else
  echo ""
  echo "⚠️  Warning: Backend health check failed"
  echo "   Check logs: docker compose logs backend"
fi

# Clean up old images
echo ""
echo "🧹 Cleaning up old images..."
docker image prune -f

echo ""
echo "✅ Deployment complete!"
