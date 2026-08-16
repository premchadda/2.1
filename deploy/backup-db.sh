#!/bin/bash
# ==============================================================================
# Trstprep PostgreSQL Backup Script (H30: no backup strategy anywhere)
#
# - Dumps all databases / the application DB to timestamped plain + custom dumps
# - Retains 7 daily and 4 weekly backups (rotate automatically)
# - Designed to be run from cron, e.g.:
#     0 2 * * *  /path/to/deploy/backup-db.sh >> /var/log/trstprep-backup.log 2>&1
#
# Requires: pg_dump, pg_dumpall (provided by the postgresql-client package).
# Set DATABASE_URL (or the individual PG* vars) in the environment / .env.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/trstprep}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"      # daily dumps kept
RETENTION_WEEKS="${RETENTION_WEEKS:-4}"    # weekly (Sunday) dumps kept
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DAY_OF_WEEK="$(date +%u)"                   # 1=Mon ... 7=Sun

mkdir -p "$BACKUP_DIR"

# Prefer an explicit DATABASE_URL; otherwise build from PG* env vars.
if [ -n "${DATABASE_URL:-}" ]; then
  export PGCONNECT_TIMEOUT=10
  CONNECT_OPTS=(--dbname "$DATABASE_URL")
else
  CONNECT_OPTS=(--host "${PGHOST:-localhost}" --port "${PGPORT:-5432}" --username "${PGUSER:-postgres}")
fi

echo "[backup] $(date -Iseconds) starting database dump -> $BACKUP_DIR"

# 1. Full cluster roles + globals (custom format, smaller, faster to restore)
if command -v pg_dumpall >/dev/null 2>&1; then
  echo "[backup] dumping globals/roles ..."
  pg_dumpall "${CONNECT_OPTS[@]}" --globals-only \
    | gzip > "$BACKUP_DIR/globals-${TIMESTAMP}.sql.gz"
fi

# 2. Per-database custom-format dump (restorable with pg_restore)
if [ -n "${DATABASE_URL:-}" ]; then
  DBNAME="$(echo "$DATABASE_URL" | sed -E 's#.*/([^?]+)(\?.*)?$#\1#')"
  echo "[backup] dumping database '$DBNAME' ..."
  pg_dump "${CONNECT_OPTS[@]}" --format=custom --no-owner --clean --if-exists \
    > "$BACKUP_DIR/${DBNAME}-${TIMESTAMP}.dump"
else
  # Fall back to dumping every database reported by psql
  for db in $(psql "${CONNECT_OPTS[@]}" -At -c "SELECT datname FROM pg_database WHERE datistemplate=false AND datallowconn;"); do
    echo "[backup] dumping database '$db' ..."
    pg_dump "${CONNECT_OPTS[@]}" --format=custom --no-owner --clean --if-exists --dbname="$db" \
      > "$BACKUP_DIR/${db}-${TIMESTAMP}.dump"
  done
fi

# 3. Retention: prune daily dumps older than RETENTION_DAYS (keep Sunday weekly copies longer)
echo "[backup] applying retention (daily=${RETENTION_DAYS}d, weekly=${RETENTION_WEEKS}w) ..."
find "$BACKUP_DIR" -name '*.dump' -mtime "+$RETENTION_DAYS" ! -name "*-sun-*.*" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'globals-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
# Weekly (Sunday) dumps kept for RETENTION_WEEKS weeks
if [ "$DAY_OF_WEEK" = "7" ]; then
  find "$BACKUP_DIR" -name '*.dump' -mtime "+$((RETENTION_WEEKS * 7))" -delete 2>/dev/null || true
fi

echo "[backup] $(date -Iseconds) done. Latest backups:"
ls -1t "$BACKUP_DIR" | head -n 5
