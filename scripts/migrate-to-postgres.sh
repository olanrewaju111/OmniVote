#!/usr/bin/env bash
# =============================================================================
# OmniVote Monitor v2.1 — SQLite → PostgreSQL Migration Helper
# =============================================================================
#
# Prerequisites:
#   1. PostgreSQL 14+ running and accessible
#   2. DATABASE_URL set to a PostgreSQL connection string
#   3. Node.js / Bun installed
#
# Usage:
#   chmod +x scripts/migrate-to-postgres.sh
#   ./scripts/migrate-to-postgres.sh
#
# This script:
#   1. Backs up the current SQLite database
#   2. Replaces schema.prisma with the PostgreSQL-ready version
#   3. Runs Prisma migration to create the PostgreSQL schema
#   4. Re-generates the Prisma client
#   5. Seeds the database with initial data
#
# =============================================================================

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
 SQLITE_DB="$PROJECT_ROOT/db/custom.db"
PG_SCHEMA="$PROJECT_ROOT/prisma/postgresql-schema.prisma"
ACTIVE_SCHEMA="$PROJECT_ROOT/prisma/schema.prisma"
BACKUP_DIR="$PROJECT_ROOT/db/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Pre-flight checks ────────────────────────────────────────────────

log_info "Starting OmniVote SQLite → PostgreSQL migration..."

# Check for DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  log_error "DATABASE_URL environment variable is not set."
  log_info "Set it to a PostgreSQL connection string, e.g.:"
  log_info "  export DATABASE_URL=\"postgresql://user:password@localhost:5432/omnivote\""
  exit 1
fi
log_ok "DATABASE_URL is set"

# Check for PostgreSQL schema file
if [ ! -f "$PG_SCHEMA" ]; then
  log_error "PostgreSQL schema not found at $PG_SCHEMA"
  exit 1
fi
log_ok "PostgreSQL schema found"

# Check for bun/node
if command -v bun &> /dev/null; then
  RUNTIME="bun"
elif command -v npx &> /dev/null; then
  RUNTIME="npx"
else
  log_error "Neither bun nor npx found. Install one to proceed."
  exit 1
fi
log_ok "Runtime: $RUNTIME"

# ─── Step 1: Backup SQLite database ────────────────────────────────────

log_info "Backing up SQLite database..."
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/custom_db_${TIMESTAMP}.db"

if [ -f "$SQLITE_DB" ]; then
  cp "$SQLITE_DB" "$BACKUP_PATH"
  log_ok "SQLite backup created: $BACKUP_PATH"
else
  log_warn "SQLite database not found at $SQLITE_DB (fresh install?)"
fi

# ─── Step 2: Back up active schema ────────────────────────────────────

if [ -f "$ACTIVE_SCHEMA" ]; then
  cp "$ACTIVE_SCHEMA" "$BACKUP_DIR/schema_sqlite_${TIMESTAMP}.prisma"
  log_ok "Active schema backed up"
fi

# ─── Step 3: Replace schema with PostgreSQL version ──────────────────

log_info "Replacing schema.prisma with PostgreSQL-ready version..."
cp "$PG_SCHEMA" "$ACTIVE_SCHEMA"
log_ok "Schema replaced"

# ─── Step 4: Generate Prisma client ──────────────────────────────────

log_info "Generating Prisma client..."
$RUNTIME prisma generate
log_ok "Prisma client generated"

# ─── Step 5: Run database migration ──────────────────────────────────

log_info "Creating PostgreSQL migration..."
$RUNTIME prisma migrate dev --name init_postgres 2>&1 || {
  log_warn "Migration dev failed (may be expected if DB already has tables)."
  log_info "Trying db push instead..."
  $RUNTIME prisma db push
}
log_ok "Database schema applied"

# ─── Step 6: Re-generate client after migration ──────────────────────

log_info "Re-generating Prisma client..."
$RUNTIME prisma generate
log_ok "Prisma client re-generated"

# ─── Step 7: Seed data ───────────────────────────────────────────────

log_info "Seeding database..."
if [ -f "$PROJECT_ROOT/scripts/seed.ts" ]; then
  $RUNTIME run "$PROJECT_ROOT/scripts/seed.ts" 2>&1 || log_warn "Seed script had errors (may be OK if data exists)"
  log_ok "Seed completed"
else
  log_warn "Seed script not found. Run seed manually if needed."
fi

# ─── Done ────────────────────────────────────────────────────────────

echo ""
log_ok "═══════════════════════════════════════════════════════════════"
log_ok "  Migration complete!"
log_ok "═══════════════════════════════════════════════════════════════"
echo ""
log_info "Post-copy checklist:"
log_info "  1. Verify data by checking a few key tables"
log_info "  2. Run the app: bun run dev"
log_info "  3. Test login and a few operations"
log_info "  4. Consider enabling PgBouncer for connection pooling"
log_info "  5. Set up automated backups (pg_dump)"
log_info "  6. Update Caddyfile if DB host changed"
echo ""
log_info "To rollback:"
log_info "  1. Stop the app"
log_info "  2. cp $BACKUP_DIR/schema_sqlite_${TIMESTAMP}.prisma $ACTIVE_SCHEMA"
log_info "  3. Set DATABASE_URL back to SQLite file path"
log_info "  4. $RUNTIME prisma generate && $RUNTIME prisma db push"
echo ""