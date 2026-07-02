#!/bin/bash
# ─── OmniVote WhatsApp Bridge Startup Script ─────────────────────
# This script starts the Go whatsmeow bridge service.
# Requirements: Go >= 1.25, CGO (for sqlite3), gcc
#
# Usage:
#   ./start-bridge.sh          # Start on default port 9090
#   PORT=8090 ./start-bridge.sh  # Custom port

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/whatsapp-bridge"
DB_PATH="${DB_PATH:-$SCRIPT_DIR/db/custom.db}"
SESSIONS_DIR="${SESSIONS_DIR:-$SCRIPT_DIR/whatsapp-bridge/sessions}"
PORT="${PORT:-9090}"

echo "=== OmniVote WhatsApp Bridge ==="
echo "DB: $DB_PATH"
echo "Sessions: $SESSIONS_DIR"
echo "Port: $PORT"

# Check Go version
GO_VERSION=$(go version 2>/dev/null | grep -oP 'go\d+\.\d+' | head -1 || echo "go0")
GO_MAJOR=$(echo "$GO_VERSION" | grep -oP '\d+' | head -1)

if [ "$GO_MAJOR" -lt 1 ] 2>/dev/null || [ "$GO_MAJOR" -lt 25 ] 2>/dev/null; then
    echo ""
    echo "⚠️  whatsmeow requires Go >= 1.25. Current: $(go version 2>/dev/null || echo 'not installed')"
    echo ""
    echo "To upgrade Go:"
    echo "  go install golang.org/dl/go1.25.0@latest"
    echo "  ~/go/bin/go1.25.0 download"
    echo "  Then use: ~/go/bin/go1.25.0 run $BRIDGE_DIR/main.go"
    echo ""
    echo "Starting in MOCK MODE (simulated WhatsApp for development)..."
    cd "$BRIDGE_DIR"
    go run mock_server.go 2>&1
    exit 0
fi

echo "Go version: $(go version)"
cd "$BRIDGE_DIR"

# Install dependencies
echo "Installing dependencies..."
go mod tidy

# Build
echo "Building..."
go build -o omnivote-wa-bridge .

# Run
echo "Starting WhatsApp bridge on :$PORT ..."
export DB_PATH
export SESSIONS_DIR
export PORT
./omnivote-wa-bridge