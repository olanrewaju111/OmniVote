#!/bin/sh
# ─── OmniVote Container Init Script ────────────────────────────────
# Runs database migrations on first start, then launches the app.
# ─────────────────────────────────────────────────────────────────────────

set -e

MIGRATION_MARKER="/app/data/.migrated-${DB_SCHEMA_VERSION:-1}"

echo "[omnivote] Starting OmniVote v0.2.0..."
echo "[omnivote] Environment: ${NODE_ENV:-production}"

# ── Run migrations if not already done ──────────────────────────────────
if [ ! -f "$MIGRATION_MARKER" ]; then
  echo "[omnivote] Running database migrations..."
  npx prisma migrate deploy 2>&1 || {
    echo "[omnivote] Migration failed, attempting prisma db push..."
    npx prisma db push --accept-data-loss 2>&1 || {
      echo "[omnivote] WARNING: Could not run migrations. The app may fail if schema is out of date."
    }
  }
  mkdir -p /app/data
  touch "$MIGRATION_MARKER"
  echo "[omnivote] Migrations complete."
else
  echo "[omnivote] Database already up-to-date (marker: $MIGRATION_MARKER)."
fi

echo "[omnivote] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
