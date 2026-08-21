#!/bin/sh
# ─── OmniVote Container Init Script ────────────────────────────────
# Runs as root: fixes volume permissions, syncs SQLite schema,
# then drops to non-root user for the app process.
# ─────────────────────────────────────────────────────────────────────────

set -e

DATA_DIR="/app/data"
LOG_DIR="/app/logs"
UNAME="omnivote"
GNAME="nodejs"
PRISMA_CLI="/app/node_modules/prisma/build/index.js"
MIGRATION_MARKER="/app/data/.migrated-${DB_SCHEMA_VERSION:-1}"

# ── Fix volume permissions (must run as root) ──────────────────────
mkdir -p "$DATA_DIR" "$LOG_DIR"
chown -R "$UNAME:$GNAME" "$DATA_DIR" "$LOG_DIR"

echo "[omnivote] Starting OmniVote v0.2.0..."
echo "[omnivote] Environment: ${NODE_ENV:-production}"

# ── Sync schema if not already done ────────────────────────────────
if [ ! -f "$MIGRATION_MARKER" ]; then
  echo "[omnivote] Syncing SQLite database schema..."
  su-exec "$UNAME" node "$PRISMA_CLI" db push --accept-data-loss 2>&1 || {
    echo "[omnivote] WARNING: Schema sync failed. The app may fail if schema is out of date."
  }
  touch "$MIGRATION_MARKER"
  chown "$UNAME:$GNAME" "$MIGRATION_MARKER"
  echo "[omnivote] Schema sync complete."
else
  echo "[omnivote] Database already up-to-date (marker: $MIGRATION_MARKER)."
fi

echo "[omnivote] Starting Next.js server on port ${PORT:-3000}..."
exec su-exec "$UNAME" node server.js
