#!/bin/sh
# ─── OmniVote Container Init Script ────────────────────────────────
# Runs as root: fixes volume permissions, seeds SQLite if needed,
# then drops to non-root user for the app process.
# ─────────────────────────────────────────────────────────────────────────

set -e

DATA_DIR="/app/data"
LOG_DIR="/app/logs"
UNAME="omnivote"
GNAME="nodejs"
SEED_DB="/app/seed/omnivote.db"
DATA_DB="$DATA_DIR/omnivote.db"
MIGRATION_MARKER="$DATA_DIR/.migrated-${DB_SCHEMA_VERSION:-1}"

# ── Fix volume permissions (must run as root) ──────────────────────
mkdir -p "$DATA_DIR" "$LOG_DIR"
chown -R "$UNAME:$GNAME" "$DATA_DIR" "$LOG_DIR"

echo "[omnivote] Starting OmniVote v0.2.0..."
echo "[omnivote] Environment: ${NODE_ENV:-production}"

# ── Seed SQLite database if not already done ───────────────────────
if [ ! -f "$MIGRATION_MARKER" ]; then
  if [ ! -f "$DATA_DB" ]; then
    echo "[omnivote] Seeding SQLite database from build-time seed..."
    cp "$SEED_DB" "$DATA_DB"
    chown "$UNAME:$GNAME" "$DATA_DB"
    echo "[omnivote] Database seeded successfully."
  else
    echo "[omnivote] Database file already exists, skipping seed."
  fi
  touch "$MIGRATION_MARKER"
  chown "$UNAME:$GNAME" "$MIGRATION_MARKER"
  echo "[omnivote] Database ready."
else
  echo "[omnivote] Database already up-to-date (marker: $MIGRATION_MARKER)."
fi

echo "[omnivote] Starting Next.js server on port ${PORT:-3000}..."
exec su-exec "$UNAME" node server.js
