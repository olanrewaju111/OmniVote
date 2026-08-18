#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# OmniVote Restore Script — Phase 14
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/sre/restore.sh <backup_path>          # Restore from backup
#   ./scripts/sre/restore.sh <backup_path> --dry-run  # Show what would be restored
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_path> [--dry-run]"
  echo ""
  echo "Available backups:"
  ls -1dt /backups/*_2* 2>/dev/null || echo "  No backups found in /backups/"
  exit 1
fi

BACKUP_PATH="$1"
DRY_RUN=false

[ "${2:-}" = "--dry-run" ] && DRY_RUN=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate backup exists
if [ ! -d "$BACKUP_PATH" ]; then
  log_error "Backup directory not found: $BACKUP_PATH"
  exit 1
fi

log_info "Restoring from: ${BACKUP_PATH}"

# Show manifest
if [ -f "${BACKUP_PATH}/manifest.json" ]; then
  log_info "Backup manifest:"
  cat "${BACKUP_PATH}/manifest.json"
fi

if [ "$DRY_RUN" = true ]; then
  log_warn "[DRY RUN] Would restore database from ${BACKUP_PATH}"
  exit 0
fi

# ─── Confirm restore ──────────────────────────────────────────────────────
read -p "This will REPLACE the current database. Are you sure? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
  log_info "Restore cancelled."
  exit 0
fi

# ─── Restore Database ─────────────────────────────────────────────────────
if [ -f "${BACKUP_PATH}/database.dump" ]; then
  log_info "Restoring PostgreSQL database..."
  pg_restore \
    -h "${POSTGRES_HOST:-postgres}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-omnivote}" \
    -d "${POSTGRES_DB:-omnivote}" \
    --clean --if-exists \
    "${BACKUP_PATH}/database.dump"
  log_info "PostgreSQL restore complete."
elif [ -f "${BACKUP_PATH}/database.db" ]; then
  log_info "Restoring SQLite database..."
  SQLITE_PATH="${SQLITE_PATH:-/app/data/omnivote.db}"
  cp "${BACKUP_PATH}/database.db" "${SQLITE_PATH}.restored"
  mv "${SQLITE_PATH}.restored" "$SQLITE_PATH"
  log_info "SQLite restore complete."
else
  log_error "No database backup found in ${BACKUP_PATH}"
  exit 1
fi

# ─── Restore Application Data ─────────────────────────────────────────────
if [ -f "${BACKUP_PATH}/data.tar.gz" ]; then
  log_info "Restoring application data..."
  DATA_DEST="${DATA_DEST:-/app/data}"
  tar xzf "${BACKUP_PATH}/data.tar.gz" -C "$(dirname "$DATA_DEST")"
  log_info "Data restore complete."
fi

log_info "Restore complete. Restart the application to apply: docker compose restart app"
