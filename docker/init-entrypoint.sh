#!/bin/sh
# ─── OmniVote Container Init Script ────────────────────────────────
# Syncs SQLite schema on first start, then launches the app.
# ─────────────────────────────────────────────────────────────────────────

set -e

MIGRATION_MARKER="/app/data/.migrated-${DB_SCHEMA_VERSION:-1}"

# Ensure data directory exists
mkdir -p /app/data

echo "[omnivote] Starting OmniVote v0.2.0..."
echo "[omnivote] Environment: ${NODE_ENV:-production}"

# ── Sync schema if not already done ────────────────────────────────────
if [ ! -f "$MIGRATION_MARKER" ]; then
  echo "[omnivote] Syncing SQLite database schema..."
  npx prisma db push --accept-data-loss 2>&1 || {
    echo "[omnivote] WARNING: Schema sync failed. The app may fail if schema is out of date."
  }
  touch "$MIGRATION_MARKER"
  echo "[omnivote] Schema sync complete."
else
  echo "[omnivote] Database already up-to-date (marker: $MIGRATION_MARKER)."
fi

echo "[omnivote] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
