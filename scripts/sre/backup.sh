#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# OmniVote Backup Script — Phase 14
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/sre/backup.sh              # Full backup (database + uploads)
#   ./scripts/sre/backup.sh --db-only    # Database backup only
#   ./scripts/sre/backup.sh --dry-run    # Show what would be backed up
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
HOSTNAME=$(hostname -s)
DB_ONLY=false
DRY_RUN=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --db-only) DB_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
    --help) echo "Usage: $0 [--db-only] [--dry-run]"; exit 0 ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Starting backup: ${TIMESTAMP}"
log_info "Retention: ${RETENTION_DAYS} days"

# ─── Pre-flight checks ──────────────────────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  mkdir -p "$BACKUP_DIR"
fi

BACKUP_PATH="${BACKUP_DIR}/${HOSTNAME}_${TIMESTAMP}"

if [ "$DRY_RUN" = true ]; then
  log_info "[DRY RUN] Would create backup at: ${BACKUP_PATH}"
fi

# ─── Database Backup ────────────────────────────────────────────────────────
log_info "Backing up database..."

if [ "$DRY_RUN" = false ]; then
  mkdir -p "$BACKUP_PATH"

  # Try PostgreSQL first (production), fall back to SQLite backup
  if command -v pg_dump &>/dev/null && [ -n "${POSTGRES_HOST:-}" ]; then
    pg_dump \
      -h "${POSTGRES_HOST:-postgres}" \
      -p "${POSTGRES_PORT:-5432}" \
      -U "${POSTGRES_USER:-omnivote}" \
      -d "${POSTGRES_DB:-omnivote}" \
      -Fc \
      -f "${BACKUP_PATH}/database.dump"
    log_info "PostgreSQL backup: $(du -sh "${BACKUP_PATH}/database.dump" | cut -f1)"
  else
    # SQLite backup (copy-on-write for safety)
    SQLITE_PATH="${SQLITE_PATH:-/app/data/omnivote.db}"
    if [ -f "$SQLITE_PATH" ]; then
      cp "$SQLITE_PATH" "${BACKUP_PATH}/database.db"
      log_info "SQLite backup: $(du -sh "${BACKUP_PATH}/database.db" | cut -f1)"
    else
      log_warn "No database file found at ${SQLITE_PATH}"
    fi
  fi
fi

# ─── Application Data Backup (media, config) ──────────────────────────────
if [ "$DB_ONLY" = false ]; then
  log_info "Backing up application data..."

  if [ "$DRY_RUN" = false ]; then
    # Copy any uploaded media/evidence files
    DATA_SRC="${DATA_SRC:-/app/data}"
    if [ -d "$DATA_SRC" ]; then
      tar czf "${BACKUP_PATH}/data.tar.gz" -C "$(dirname "$DATA_SRC")" "$(basename "$DATA_SRC")" 2>/dev/null || true
      log_info "Data backup: $(du -sh "${BACKUP_PATH}/data.tar.gz" | cut -f1)"
    fi
  fi
fi

# ─── Backup Manifest ────────────────────────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  cat > "${BACKUP_PATH}/manifest.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "hostname": "${HOSTNAME}",
  "type": "${DB_ONLY}" ? "database-only" : "full",
  "files": $(ls -la "$BACKUP_PATH" | awk 'NR>1{print "{\"name\":\""$9"\",\"size\":"$5"}"}' | paste -sd ',' - | sed 's/^/[/;s/$/]/')
}
EOF
fi

# ─── Cleanup Old Backups ───────────────────────────────────────────────────
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

if [ "$DRY_RUN" = false ]; then
  DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name "${HOSTNAME}_*" -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + 2>/dev/null | wc -l)
  if [ "$DELETED" -gt 0 ]; then
    log_info "Deleted ${DELETED} old backup(s)"
  else
    log_info "No old backups to delete"
  fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
TOTAL_SIZE=0
if [ "$DRY_RUN" = false ]; then
  TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
fi

log_info "Backup complete: ${BACKUP_PATH} (${TOTAL_SIZE})"
log_info "Backup manifest: ${BACKUP_PATH}/manifest.json"