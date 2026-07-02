#!/bin/bash
cd /home/z/my-project
rm -f .next/dev/lock

LOG="/tmp/ov-server.log"
echo "[$(date)] Heartbeat server starting" > "$LOG"

while true; do
  echo "[$(date)] Launching next dev..." >> "$LOG"
  npx next dev -p 3000 >> "$LOG" 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Server PID: $SERVER_PID" >> "$LOG"
  
  # Keep server alive with heartbeat requests
  for i in $(seq 1 600); do
    sleep 2
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server process died at iteration $i" >> "$LOG"
      break
    fi
    # Send heartbeat every 2 seconds to prevent idle kill
    curl -s --connect-timeout 2 --max-time 5 -o /dev/null http://127.0.0.1:3000/api/dashboard 2>/dev/null
  done
  
  # If loop completed (10 min), restart anyway to prevent memory bloat
  kill $SERVER_PID 2>/dev/null
  echo "[$(date)] Restarting server..." >> "$LOG"
  sleep 3
  rm -f .next/dev/lock
done