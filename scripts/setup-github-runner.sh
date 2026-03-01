#!/bin/bash
set -e

echo "🏃 Setting up GitHub Actions self-hosted runner..."
echo ""

RUNNER_DIR="$HOME/actions-runner"

# Create runner directory
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

# Download latest runner if not already downloaded
if [ ! -f "run.sh" ]; then
  echo "📥 Downloading GitHub Actions runner..."

  # Get latest runner version
  RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
  RUNNER_VERSION=${RUNNER_VERSION#v}

  # Download for Linux x64
  curl -o actions-runner-linux-x64.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

  # Extract
  tar xzf actions-runner-linux-x64.tar.gz
  rm actions-runner-linux-x64.tar.gz

  echo "✅ Runner downloaded"
else
  echo "✅ Runner already downloaded"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Get your runner token from GitHub:"
echo "   https://github.com/rmcenery/Prediction-markets/settings/actions/runners/new"
echo ""
echo "2. Configure the runner:"
echo "   cd $RUNNER_DIR"
echo "   ./config.sh --url https://github.com/rmcenery/Prediction-markets --token YOUR_TOKEN"
echo ""
echo "3. Install as a service (runs in background):"
echo "   sudo ./svc.sh install"
echo "   sudo ./svc.sh start"
echo ""
echo "4. Or run manually (for testing):"
echo "   ./run.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After setup, every push to main will auto-deploy! 🚀"
