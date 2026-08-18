#!/usr/bin/env bash
# ─── OmniVote Health Check Script ─────────────────────────────────────
# Task ID: 6 — Phase 14: Deployment & DevOps
#
# Usage: ./scripts/healthcheck.sh [URL]
#   Default URL: http://localhost:3000/api/health
#   Exit 0 = healthy, Exit 1 = unhealthy
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

HEALTH_URL="${1:-http://localhost:3000/api/health}"
TIMEOUT=10

# Call the health endpoint and capture HTTP status + body
RESPONSE=$(curl -s -w '\n%{http_code}' --max-time "$TIMEOUT" "$HEALTH_URL" 2>/dev/null) || {
  echo "ERROR: Failed to connect to $HEALTH_URL"
  exit 1
}

# Split response into body and status code
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check HTTP status is 200
if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Expected HTTP 200, got $HTTP_STATUS"
  echo "Response: $BODY"
  exit 1
fi

# Check JSON contains {"status":"ok"} or {"status":"healthy"}
STATUS_VALUE=$(echo "$BODY" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | grep -o '"[^"]*"$' | tr -d '"')

if [ "$STATUS_VALUE" != "ok" ] && [ "$STATUS_VALUE" != "healthy" ]; then
  echo "ERROR: Expected status 'ok' or 'healthy', got '$STATUS_VALUE'"
  echo "Response: $BODY"
  exit 1
fi

echo "OK: Health check passed (status=$STATUS_VALUE, http=$HTTP_STATUS)"
exit 0
