#!/bin/bash
# Keepalive script for OmniVote production deployment
# Starts the standalone server and keeps it alive via periodic health checks

SERVER_URL="https://v10hw5v35e80-d.space-z.ai/"
LOCAL_URL="http://127.0.0.1:3456/api/health"
PORT=3456
TIMEOUT=600000
INTERVAL=30

echo "[$(date)] Starting OmniVote production server on port $PORT..."
cd /home/z/my-project
PORT=$PORT node .next/standalone/server.js > /tmp/omnivote-server.log 2>&1 &
SERVER_PID=$!
echo "[$(date)] Server PID: $SERVER_PID"

# Wait for server to start
sleep 3

# Keepalive loop
echo "[$(date)] Starting keepalive loop (every ${INTERVAL}s, timeout ${TIMEOUT}ms)"
STARTED=$(date +%s)
while true; do
    NOW=$(date +%s)
    ELAPSED=$(( (NOW - STARTED) * 1000 ))

    if [ "$ELAPSED" -gt "$TIMEOUT" ]; then
        echo "[$(date)] Keepalive timeout (${TIMEOUT}ms) reached. Exiting."
        break
    fi

    # Check local health first (fast)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$LOCAL_URL" 2>/dev/null || echo "000")

    # If local check fails, also check production URL
    if [ "$HTTP_CODE" = "000" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SERVER_URL" 2>/dev/null || echo "000")
    fi

    if [ "$HTTP_CODE" = "000" ]; then
        echo "[$(date)] Server unresponsive. Restarting..."
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        sleep 2
        PORT=$PORT node .next/standalone/server.js > /tmp/omnivote-server.log 2>&1 &
        SERVER_PID=$!
        sleep 3
        echo "[$(date)] New server PID: $SERVER_PID"
    else
        echo "[$(date)] Health check OK (HTTP $HTTP_CODE)"
    fi

    sleep $INTERVAL
done