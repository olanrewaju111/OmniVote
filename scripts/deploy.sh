#!/usr/bin/env bash
# ─── OmniVote Deployment Helper Script ─────────────────────────────────
# Task ID: 6 — Phase 14: Deployment & DevOps
#
# Usage:
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

ENV="${1:?Usage: deploy.sh <staging|production>}"
DEPLOY_DIR="${2:-.}"
MAX_RETRIES=30
RETRY_INTERVAL=5

# Validate environment
if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
  echo "ERROR: Environment must be 'staging' or 'production', got '$ENV'"
  exit 1
fi

echo "========================================="
echo "  OmniVote Deployment — $ENV"
echo "========================================="

# Step 1: Pull latest images
echo ""
echo "[1/4] Pulling latest images..."
if [ "$ENV" = "production" ]; then
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.prod.yml" pull
else
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" pull
fi

# Step 2: Run database migrations
echo ""
echo "[2/4] Running database migrations..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" run --rm app npx prisma db push --skip-generate 2>/dev/null || \
  echo "  Warning: Migration step skipped or non-fatal"

# Step 3: Restart services
echo ""
echo "[3/4] Restarting services..."
if [ "$ENV" = "production" ]; then
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.prod.yml" up -d --remove-orphans
else
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" up -d --remove-orphans
fi
docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps

# Step 4: Wait for health check
echo ""
echo "[4/4] Waiting for health check (timeout: $((MAX_RETRIES * RETRY_INTERVAL))s)..."
HEALTHY=0
for i in $(seq 1 $MAX_RETRIES); do
  if bash "$(dirname "$0")/healthcheck.sh" http://localhost:3000/api/health 2>/dev/null; then
    HEALTHY=1
    echo "  Service healthy after $((i * RETRY_INTERVAL))s"
    break
  fi
  echo "  Attempt $i/$MAX_RETRIES — waiting ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

if [ "$HEALTHY" -ne 1 ]; then
  echo ""
  echo "ERROR: Health check failed after $((MAX_RETRIES * RETRY_INTERVAL))s"
  echo "Showing recent app logs:"
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" logs --tail=30 app
  exit 1
fi

echo ""
echo "========================================="
echo "  Deployment complete ($ENV)"
echo "========================================="
