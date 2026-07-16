#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# OmniVote – First-time server setup
# ──────────────────────────────────────────────────────────────────────────────
# Run this ONCE on the remote server to prepare it for Docker deployments.
#
# Usage:  ./scripts/setup-server.sh user@hostname
# Example: ./scripts/setup-server.sh deploy@203.0.113.50
#
# Prerequisites:
#   - SSH key-based auth configured for the remote server
#   - Docker NOT pre-installed (this script handles it)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REMOTE="${1:?Usage: $0 user@hostname}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new"

echo "╔══════════════════════════════════════════════╗"
echo "║   OmniVote — Remote Server Setup            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Install Docker ────────────────────────────────────────────────────
echo ">>> [1/5] Installing Docker..."
ssh $SSH_OPTS "$REMOTE" '
  # Detect package manager
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v apk &>/dev/null; then
    sudo apk add docker docker-compose
  fi

  # Enable Docker
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker $USER
  echo "Docker installed: $(docker --version)"
'

# ── 2. Create deploy directory ────────────────────────────────────────────
echo ">>> [2/5] Creating deploy directories..."
ssh $SSH_OPTS "$REMOTE" '
  sudo mkdir -p /opt/omnivote/{nginx,nginx/conf.d,data}
  sudo chown -R $USER:$USER /opt/omnivote
  echo "Directory created: /opt/omnivote"
'

# ── 3. Configure firewall ────────────────────────────────────────────────
echo ">>> [3/5] Configuring firewall..."
ssh $SSH_OPTS "$REMOTE" '
  if command -v ufw &>/dev/null; then
    sudo ufw allow 22/tcp    comment "SSH"
    sudo ufw allow 80/tcp    comment "HTTP"
    sudo ufw allow 443/tcp   comment "HTTPS"
    echo "Firewall configured (ufw)"
  elif command -v firewall-cmd &>/dev/null; then
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    echo "Firewall configured (firewalld)"
  else
    echo "No firewall detected — open ports 80/443 manually if needed"
  fi
'

# ── 4. Install Docker Compose plugin (if missing) ────────────────────────
echo ">>> [4/5] Verifying Docker Compose..."
ssh $SSH_OPTS "$REMOTE" '
  if ! docker compose version &>/dev/null; then
    echo "Installing docker-compose-plugin..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get install -y -qq docker-compose-plugin
    fi
  fi
  docker compose version
'

# ── 5. Done ──────────────────────────────────────────────────────────────
echo ">>> [5/5] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add these secrets to your GitHub repo (Settings → Secrets → Actions):"
echo "     SSH_PRIVATE_KEY          — cat ~/.ssh/id_ed25519"
echo "     DEPLOY_HOST              — $(echo $REMOTE | cut -d@ -f2)"
echo "     DEPLOY_USER              — $(echo $REMOTE | cut -d@ -f1)"
echo "     DEPLOY_PATH              — /opt/omnivote"
echo "     JWT_SECRET               — $(openssl rand -base64 48)"
echo "     OMNIVOTE_ENCRYPTION_KEY  — $(openssl rand -base64 32)"
echo ""
echo "  2. Push to main branch to trigger deployment:"
echo "     git push origin main"
echo ""
echo "  3. Or trigger manually:"
echo "     → GitHub repo → Actions → Deploy to Server → Run workflow"