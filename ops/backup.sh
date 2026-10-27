#!/usr/bin/env bash
# NFR-04 / NFR-03: nightly PostgreSQL backup for the Docker Compose deployment.
#   ./ops/backup.sh                 # writes backups/sams_<timestamp>.sql.gz, keeps 30 days
# Schedule with cron on the host, e.g.:
#   15 2 * * * cd /opt/sams && ./ops/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/sams_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
docker compose exec -T postgres pg_dump -U sams -d sams --no-owner --clean --if-exists | gzip -9 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

# Optional encryption at rest (SR-03): set BACKUP_PASSPHRASE to produce .gpg files
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$OUT.gpg" "$OUT"
  rm -f "$OUT"
  OUT="$OUT.gpg"
fi

find "$BACKUP_DIR" -name 'sams_*.sql.gz*' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup written: $OUT ($(du -h "$OUT" | cut -f1))"
