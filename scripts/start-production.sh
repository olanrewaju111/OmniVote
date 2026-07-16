#!/bin/bash
# OmniVote Production Startup Script
cd /home/z/my-project

# Export required environment variables
export NODE_ENV=production
export PORT=3000
export JWT_SECRET="${JWT_SECRET:-24696572ebf8fdecc36185ecbd197a40197c1d20dfb78c100d3c566ebd17f06a}"
export DATABASE_URL="file:/home/z/my-project/db/custom.db"

# Ensure the server.js can find everything
exec node .next/standalone/server.js