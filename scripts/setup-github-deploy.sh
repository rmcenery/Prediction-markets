#!/bin/bash
set -e

echo "🔧 Setting up GitHub Actions deployment..."
echo ""

# Generate SSH key for GitHub Actions if it doesn't exist
SSH_KEY_PATH="$HOME/.ssh/github_actions_deploy"
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Generating SSH key for GitHub Actions..."
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "github-actions-deploy"
  echo "✅ SSH key generated at $SSH_KEY_PATH"
else
  echo "✅ SSH key already exists at $SSH_KEY_PATH"
fi

# Add public key to authorized_keys
if ! grep -q "$(cat $SSH_KEY_PATH.pub)" "$HOME/.ssh/authorized_keys" 2>/dev/null; then
  cat "$SSH_KEY_PATH.pub" >> "$HOME/.ssh/authorized_keys"
  echo "✅ Public key added to authorized_keys"
else
  echo "✅ Public key already in authorized_keys"
fi

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me || echo "Unable to detect")

echo ""
echo "📋 Add these secrets to your GitHub repository:"
echo "   Go to: https://github.com/YOUR_USERNAME/Prediction-markets/settings/secrets/actions"
echo ""
echo "   SSH_HOST: $PUBLIC_IP"
echo "   SSH_USER: $USER"
echo "   SSH_PORT: 22"
echo "   SSH_PRIVATE_KEY:"
echo "   ↓ Copy everything below (including BEGIN and END lines) ↓"
echo "----------------------------------------"
cat "$SSH_KEY_PATH"
echo "----------------------------------------"
echo ""
echo "⚠️  SECURITY: Keep this private key secure!"
echo "⚠️  After adding to GitHub, you can delete this key from your local machine if desired."
echo ""
echo "✅ Setup complete! Push to GitHub to trigger deployment."
