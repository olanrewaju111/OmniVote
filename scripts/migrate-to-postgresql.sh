#!/usr/bin/env bash
# =============================================================================
# migrate-to-postgresql.sh — OmniVote Monitor SQLite → PostgreSQL migration
# =============================================================================
# Prerequisites:
#   - A running PostgreSQL instance (locally or remote)
#   - Database "omnivote" created (or the name you choose)
#   - Node.js / npm / npx available on PATH
#   - This script run from the project root directory
#
# Usage:
#   chmod +x scripts/migrate-to-postgresql.sh
#   ./scripts/migrate-to-postgresql.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors for output
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Step 0: Verify we're in the project root
# ---------------------------------------------------------------------------
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  error "This script must be run from the OmniVote project root directory."
  exit 1
fi

PRISMA_DIR="prisma"
SQLITE_SCHEMA="$PRISMA_DIR/schema.prisma"
PG_SCHEMA="$PRISMA_DIR/postgresql-schema.prisma"
BACKUP_SCHEMA="$PRISMA_DIR/schema.prisma.sqlite.bak"

# ---------------------------------------------------------------------------
# Step 1: Show current provider
# ---------------------------------------------------------------------------
info "Current database provider:"
CURRENT_PROVIDER=$(grep -E '^\s*provider\s*=' "$SQLITE_SCHEMA" | head -1 | sed 's/.*provider\s*=\s*"\(.*\)".*/\1/' || echo "unknown")
echo "       provider = \"$CURRENT_PROVIDER\""

if [ "$CURRENT_PROVIDER" = "postgresql" ]; then
  warn "Schema already uses provider = \"postgresql\"."
  read -rp "       Continue anyway? [y/N] " CONTINUE
  if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    info "Aborted."
    exit 0
  fi
fi

echo ""
info "Migration plan:"
echo "       1. Back up current SQLite schema"
echo "       2. Replace schema with PostgreSQL version (native Json types)"
echo "       3. Update DATABASE_URL"
echo "       4. Run prisma generate"
echo "       5. Run prisma migrate dev"
echo "       6. If anything fails, restore SQLite schema"
echo ""

read -rp "       Proceed with migration? [y/N] " PROCEED
if [[ "$PROCEED" != "y" && "$PROCEED" != "Y" ]]; then
  info "Aborted."
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 2: Back up SQLite schema
# ---------------------------------------------------------------------------
info "Backing up current schema → $BACKUP_SCHEMA"
if [ -f "$BACKUP_SCHEMA" ]; then
  warn "Backup file already exists. Overwriting."
fi
cp "$SQLITE_SCHEMA" "$BACKUP_SCHEMA"
ok "SQLite schema backed up."

# ---------------------------------------------------------------------------
# Step 3: Swap schema files
# ---------------------------------------------------------------------------
if [ ! -f "$PG_SCHEMA" ]; then
  error "PostgreSQL schema not found at $PG_SCHEMA"
  info "Restoring original schema..."
  cp "$BACKUP_SCHEMA" "$SQLITE_SCHEMA"
  exit 1
fi

info "Swapping schema: $SQLITE_SCHEMA ← $PG_SCHEMA"
cp "$PG_SCHEMA" "$SQLITE_SCHEMA"
ok "Schema swapped."

# ---------------------------------------------------------------------------
# Step 4: Prompt for DATABASE_URL
# ---------------------------------------------------------------------------
echo ""
info "Enter your PostgreSQL connection string."
echo "       Format: postgresql://user:password@host:5432/dbname?schema=public"
echo "       Example: postgresql://omnivote:secret@localhost:5432/omnivote?schema=public"
echo ""

# Check if .env.local already has DATABASE_URL
if [ -f ".env.local" ] && grep -q "DATABASE_URL" .env.local 2>/dev/null; then
  CURRENT_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | sed 's/DATABASE_URL=//')
  echo -n "       Current DATABASE_URL: "
  echo "${CYAN}${CURRENT_URL}${NC}"
  read -rp "       New DATABASE_URL (Enter to keep current): " NEW_URL
  if [ -n "$NEW_URL" ]; then
    DATABASE_URL="$NEW_URL"
  else
    DATABASE_URL="$CURRENT_URL"
  fi
else
  read -rp "       DATABASE_URL: " DATABASE_URL
  if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL cannot be empty."
    info "Restoring SQLite schema..."
    cp "$BACKUP_SCHEMA" "$SQLITE_SCHEMA"
    exit 1
  fi
fi

# Validate URL starts with postgresql://
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
  error "DATABASE_URL must start with 'postgresql://'"
  info "Restoring SQLite schema..."
  cp "$BACKUP_SCHEMA" "$SQLITE_SCHEMA"
  exit 1
fi

# Write to .env.local
info "Writing DATABASE_URL to .env.local"
if [ -f ".env.local" ] && grep -q "DATABASE_URL" .env.local 2>/dev/null; then
  # Update existing line
  sed -i.tmp "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env.local
  rm -f .env.local.tmp
else
  echo "DATABASE_URL=${DATABASE_URL}" >> .env.local
fi
export DATABASE_URL
ok "DATABASE_URL set."

# ---------------------------------------------------------------------------
# Step 5: Run prisma generate
# ---------------------------------------------------------------------------
echo ""
info "Running prisma generate..."
if ! npx prisma generate; then
  error "prisma generate failed!"
  info "Restoring SQLite schema..."
  cp "$BACKUP_SCHEMA" "$SQLITE_SCHEMA"
  # Remove DATABASE_URL from .env.local
  sed -i.tmp '/^DATABASE_URL=postgresql:\/\//d' .env.local
  rm -f .env.local.tmp
  exit 1
fi
ok "Prisma client generated successfully."

# ---------------------------------------------------------------------------
# Step 6: Run prisma migrate dev
# ---------------------------------------------------------------------------
echo ""
info "Running prisma migrate dev --name init_pg..."
if ! npx prisma migrate dev --name init_pg; then
  error "prisma migrate dev failed!"
  info "Restoring SQLite schema..."
  cp "$BACKUP_SCHEMA" "$SQLITE_SCHEMA"
  error "Migration failed. The PostgreSQL schema is still in place."
  echo ""
  info "To debug:"
  echo "       1. Ensure your PostgreSQL server is running"
  echo "       2. Ensure the database exists: createdb omnivote"
  echo "       3. Check DATABASE_URL credentials"
  echo "       4. Re-run this script"
  echo ""
  info "To fully revert to SQLite:"
  echo "       cp prisma/schema.prisma.sqlite.bak prisma/schema.prisma"
  echo "       npx prisma generate"
  exit 1
fi
ok "Migration applied successfully."

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} PostgreSQL migration complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
info "Next steps:"
echo "       1. Migrate your existing data (if any) using a tool like pgloader:"
echo "          pgloader sqlite://$(pwd)/db/custom.db postgresql://omnivote:secret@localhost:5432/omnivote"
echo ""
echo "       2. If you have String→Json columns, note that data stored as"
echo "          JSON strings in SQLite will need a one-time cast to JSONB."
echo "          See: prisma/postgresql-schema.prisma header for details."
echo ""
echo "       3. Restart the application:"
echo "          npm run dev   # or your production start command"
echo ""
echo "       4. For production, consider PgBouncer for connection pooling."
echo ""
info "Your SQLite schema backup is at: $BACKUP_SCHEMA"