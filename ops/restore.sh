#!/usr/bin/env bash
# Restore a backup made by ops/backup.sh into the running Compose stack.
#   ./ops/restore.sh backups/sams_20261028_021500.sql.gz
# The API is stopped during the restore so no writes land half-way.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?usage: ops/restore.sh <backup file>}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }

read -r -p "This replaces all data in the 'sams' database with $FILE. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

docker compose stop api retention
if [[ "$FILE" == *.gpg ]]; then
  gpg --batch --pinentry-mode loopback --passphrase "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}" -d "$FILE" | gunzip | docker compose exec -T postgres psql -q -U sams -d sams -v ON_ERROR_STOP=1
else
  gunzip -c "$FILE" | docker compose exec -T postgres psql -q -U sams -d sams -v ON_ERROR_STOP=1
fi
docker compose start api

echo "Restored $FILE. Waiting for the API health check..."
for _ in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/v1/health >/dev/null; then
    docker compose start retention
    # Nginx resolves the API container address on startup; refresh it after a stop/start.
    docker compose restart client
    for _ in $(seq 1 30); do
      if curl -fsS http://localhost:5173/api/v1/health >/dev/null; then
        echo "API and web proxy healthy; retention worker restarted."
        exit 0
      fi
      sleep 2
    done
    echo "Web proxy did not recover; check: docker compose logs client"
    exit 1
  fi
  sleep 2
done
echo "API did not become healthy; check: docker compose logs api"; exit 1
