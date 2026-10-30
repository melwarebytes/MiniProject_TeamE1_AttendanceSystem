#!/usr/bin/env bash
# Disposable CI stack only. Never run this against a deployment with real data.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "${CI:-}" == true && "${COMPOSE_PROJECT_NAME:-}" == sams_sprint_ci ]] || { echo 'This drill requires the isolated CI project.'; exit 1; }
cp .env.example .env
# These secrets belong only to the disposable CI database.
cat >> .env <<'ENV'
JWT_SECRET=ci-isolated-stack-signing-key-2026
QR_HMAC_SECRET=ci-isolated-stack-qr-key-2026
ENV
docker compose up --build -d --wait --wait-timeout 240
mkdir -p release-results
docker compose exec -T api npm run seed
counts() { docker compose exec -T postgres psql -U sams -d sams -Atc 'SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM sessions), (SELECT count(*) FROM attendance_records), (SELECT count(*) FROM audit_logs)'; }
counts > release-results/seed-counts.txt
docker compose exec -T api npm run seed
counts > release-results/reseed-counts.txt
diff -u release-results/seed-counts.txt release-results/reseed-counts.txt
curl -fsS http://localhost:5173/ > /dev/null
curl -fsS http://localhost:5173/api/v1/health > release-results/health-before.json
BACKUP_DIR=release-results/backups ./ops/backup.sh
# A sentinel proves restore actually replaces the changed data.
docker compose exec -T postgres psql -U sams -d sams -v ON_ERROR_STOP=1 -c "UPDATE users SET name='RESTORE_SENTINEL' WHERE email='admin@pes.edu'"
backup=$(find release-results/backups -name '*.sql.gz' -type f | head -1)
printf 'RESTORE\n' | ./ops/restore.sh "$backup"
counts > release-results/restored-counts.txt
diff -u release-results/seed-counts.txt release-results/restored-counts.txt
restored=$(docker compose exec -T postgres psql -U sams -d sams -Atc "SELECT name FROM users WHERE email='admin@pes.edu'")
[[ "$restored" == 'System Admin' ]]
curl -fsS http://localhost:5173/api/v1/health > release-results/health-after.json
printf 'Fresh deployment, repeat seed, proxy health and backup/restore: PASS\n' > release-results/summary.txt
