# 8 · Deployment, Infrastructure and Environment Setup

## Architecture
Three-tier web application (see [4_Architecture_and_Design](../4_Architecture_and_Design/)): React SPA served by Nginx → Node.js / Express API → PostgreSQL 15 and Redis 7, each in its own Docker container.

| Container | Image | Purpose | Port |
|---|---|---|---|
| `client` | built from `client/Dockerfile` (Nginx) | Serves the web app; forwards `/api/` to the API | 5173 → 80 |
| `api` | built from `server/Dockerfile` (Node 22) | REST API; applies migrations on start | 3000 |
| `postgres` | `postgres:15` | Main database (volume `pgdata`) | internal |
| `redis` | `redis:7-alpine` | QR check-in windows, nonces and check-in locks | internal |

## Prerequisites
- Docker and Docker Compose
- Node.js 20.19+ (only for running without Docker)
- Git

## Run with Docker
```bash
git clone https://github.com/melwarebytes/MiniProject_TeamE1_AttendanceSystem
cd MiniProject_TeamE1_AttendanceSystem
cp .env.example .env              # set JWT_SECRET and QR_HMAC_SECRET (openssl rand -base64 48)
docker compose up --build -d
docker compose exec api npm run seed   # demo accounts
```
| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| API health check | http://localhost:3000/api/v1/health |

## Run without Docker (development)
Needs a local PostgreSQL and Redis.
```bash
cd server && cp .env.example .env && npm install && npx prisma db push && npm run seed && npm run dev
cd client && npm install && npm run dev      # http://localhost:5173, proxies /api to :3000
```

## Environment variables
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (set by Compose) |
| `REDIS_URL` | Redis connection string (set by Compose) |
| `JWT_SECRET` | Signing key for access tokens |
| `JWT_EXPIRES_IN` | Access token lifetime, `15m` (SR-07) |
| `QR_HMAC_SECRET` | Signing key for QR check-in tokens (SR-05) |
| `APP_URL` | Public URL of the web app, used in password-reset links |
| `COOKIE_SECURE` | `true` when served over HTTPS; `false` for plain-http local runs |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email provider. Leave `SMTP_HOST` empty to print emails to the API log |

## Health checks and restarts (NFR-03)
- `GET /api/v1/health` returns `200 {"status":"ok"}` when the database and Redis both answer, and `503 {"status":"degraded"}` with the failing check otherwise.
- Every container has a Docker health check and `restart: unless-stopped`, so a crashed container is restarted automatically. The client waits for a healthy API, and the API waits for healthy Postgres and Redis.
- The API shuts down gracefully on `SIGTERM` (finishes in-flight requests, then closes database and Redis connections).
- For uptime monitoring (99.5% target), point any HTTP monitor at the health URL with a 1-minute interval.

## Backup and restore (NFR-04)
| Script | What it does |
|---|---|
| [`ops/backup.sh`](../ops/backup.sh) | `pg_dump` of the `sams` database → `backups/sams_<timestamp>.sql.gz`; deletes backups older than 30 days. Set `BACKUP_PASSPHRASE` to encrypt with AES-256 (SR-03). |
| [`ops/restore.sh`](../ops/restore.sh) | Stops the API, restores a chosen backup, starts the API and waits for the health check. Asks you to type `RESTORE` first. |

Nightly schedule on the host (02:15 every day):
```cron
15 2 * * * cd /opt/sams && ./ops/backup.sh >> backups/backup.log 2>&1
```
Copy the `backups/` folder off the server (for example with `rclone` or `rsync`) so a disk failure does not take the backups with it.

### Restore drill
| Date | Backup size | Result |
|---|---|---|
| 28 Oct 2026 | 11 KB (gzip) | Dump restored into an empty database; user, attendance-record and audit-log counts matched the source exactly. |

Repeat the drill once per quarter and add a row here.

## CI/CD
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request to `main`: server lint and Jest tests against real PostgreSQL and Redis services, the client build, and a check that each PR links a backlog issue.
