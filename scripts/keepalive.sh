#!/bin/bash
cd /home/z/my-project
while true; do
  PORT=3000 bun run .next/standalone/server.js 2>/dev/null
  sleep 2
done
