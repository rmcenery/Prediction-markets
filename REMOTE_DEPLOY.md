# Remote Deployment Guide

Deploy to your production server from any computer without manual intervention.

## 🎯 Quick Overview

You have 3 options for remote deployment:

1. **GitHub Actions (Recommended)** - Fully automated, deploys on every push
2. **Manual SSH** - One command from any computer
3. **Webhook** - Auto-deploy when you push to GitHub

---

## Option 1: GitHub Actions (Fully Automated) ⭐

**Best for:** Automatic deployments on every push to main

### Setup (One-time, 5 minutes)

1. **Run the setup script on your server:**
   ```bash
   cd ~/Prediction-markets
   ./scripts/setup-github-deploy.sh
   ```

2. **Add secrets to GitHub:**
   - Go to: `https://github.com/YOUR_USERNAME/Prediction-markets/settings/secrets/actions`
   - Click **"New repository secret"**
   - Add the 4 secrets shown by the setup script:
     - `SSH_HOST` - Your server's public IP
     - `SSH_USER` - Your username (e.g., `connor`)
     - `SSH_PORT` - SSH port (usually `22`)
     - `SSH_PRIVATE_KEY` - The private key shown by the script

3. **Push the workflow file:**
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "Add GitHub Actions deployment"
   git push origin main
   ```

### How to Use

Just push to GitHub from any computer:

```bash
# Make your changes
git add .
git commit -m "Update feature"
git push origin main

# GitHub Actions automatically deploys! ✨
```

**Check deployment status:**
- Go to: `https://github.com/YOUR_USERNAME/Prediction-markets/actions`
- Watch the deployment progress in real-time

---

## Option 2: Manual SSH Deploy (Simple)

**Best for:** Quick deployments without automation

### Setup (One-time, 2 minutes)

1. **Make sure you can SSH to your server:**
   ```bash
   ssh connor@YOUR_SERVER_IP
   ```

2. **Create an alias for easy deployment** (optional):
   ```bash
   # Add to ~/.bashrc or ~/.zshrc on your local machine
   alias deploy-polymarket='ssh connor@YOUR_SERVER_IP "cd ~/Prediction-markets && ./scripts/deploy.sh"'
   ```

### How to Use

**From your local machine:**

```bash
# Push your changes
git add .
git commit -m "Update feature"
git push origin main

# SSH in and deploy
ssh connor@YOUR_SERVER_IP "cd ~/Prediction-markets && ./scripts/deploy.sh"

# Or use the alias if you set it up:
deploy-polymarket
```

**One-liner deploy:**
```bash
git push && ssh connor@YOUR_SERVER_IP "cd ~/Prediction-markets && ./scripts/deploy.sh"
```

---

## Option 3: Webhook Listener (Advanced)

**Best for:** Auto-deploy on push without GitHub Actions

### Setup

1. **Install webhook listener on your server:**
   ```bash
   # Install webhook
   sudo apt install webhook  # Ubuntu/Debian
   # or
   brew install webhook       # macOS
   ```

2. **Create webhook config:**
   ```bash
   cat > ~/webhook-config.json << 'EOF'
   [
     {
       "id": "deploy-polymarket",
       "execute-command": "/home/connor/Prediction-markets/scripts/deploy.sh",
       "command-working-directory": "/home/connor/Prediction-markets",
       "response-message": "Deploying...",
       "trigger-rule": {
         "match": {
           "type": "payload-hash-sha1",
           "secret": "YOUR_SECRET_HERE",
           "parameter": {
             "source": "header",
             "name": "X-Hub-Signature"
           }
         }
       }
     }
   ]
   EOF
   ```

3. **Start webhook listener:**
   ```bash
   webhook -hooks ~/webhook-config.json -verbose -port 9000
   ```

4. **Configure GitHub webhook:**
   - Go to: `https://github.com/YOUR_USERNAME/Prediction-markets/settings/hooks`
   - Add webhook: `http://YOUR_SERVER_IP:9000/hooks/deploy-polymarket`
   - Secret: Same as in webhook-config.json
   - Content type: `application/json`
   - Events: Just the push event

---

## Comparison

| Feature | GitHub Actions | Manual SSH | Webhook |
|---------|---------------|------------|---------|
| Setup Complexity | Medium | Easy | Hard |
| Auto-deploy on push | ✅ Yes | ❌ No | ✅ Yes |
| Works from anywhere | ✅ Yes | ✅ Yes | ✅ Yes |
| Requires server access | ⚠️ One-time | ✅ Every time | ❌ No |
| Build logs | ✅ GitHub UI | Terminal | Server logs |
| Free | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Deployment Workflow

No matter which option you choose, the deployment process is:

1. **Pull** latest code from GitHub
2. **Build** Docker images
3. **Stop** old containers
4. **Start** new containers
5. **Verify** health checks
6. **Clean up** old images

---

## Troubleshooting

### Deployment fails

**Check logs on server:**
```bash
ssh connor@YOUR_SERVER_IP
cd ~/Prediction-markets
docker compose logs -f
```

### Can't connect via SSH

**Test SSH connection:**
```bash
ssh -v connor@YOUR_SERVER_IP
```

**Check firewall:**
```bash
# On server
sudo ufw status
sudo ufw allow 22/tcp  # Allow SSH
```

### GitHub Actions stuck

**Check secrets are correct:**
- Go to repository settings → Secrets
- Verify `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`

**Test SSH key manually:**
```bash
# Use the private key from GitHub secrets
ssh -i /path/to/private_key connor@YOUR_SERVER_IP
```

---

## Security Best Practices

1. **SSH Keys:**
   - Use separate SSH keys for GitHub Actions
   - Disable password authentication: `sudo nano /etc/ssh/sshd_config`
   - Set `PasswordAuthentication no`

2. **Firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow 22      # SSH
   sudo ufw allow 80      # HTTP
   sudo ufw allow 443     # HTTPS
   sudo ufw allow 8080    # Frontend (if needed)
   ```

3. **Fail2ban:**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

4. **Keep secrets secret:**
   - Never commit `.env` files
   - Use GitHub Secrets for sensitive data
   - Rotate SSH keys periodically

---

## Next Steps

1. Choose your deployment method
2. Follow the setup instructions
3. Test a deployment
4. Code from any computer and deploy with ease! 🚀

**Recommended:** Start with **GitHub Actions** for the best experience.
