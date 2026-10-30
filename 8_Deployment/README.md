# 8 · Deployment, Infrastructure and Environment Setup

## Architecture
Three-tier web application (see [4_Architecture_and_Design](../4_Architecture_and_Design/)): React SPA served by Nginx → Node.js / Express API → PostgreSQL 15 and Redis 7, each in its own Docker container.

| Container | Image | Purpose | Port |
|---|---|---|---|
| `client` | built from `client/Dockerfile` (Nginx) | Serves the web app; forwards `/api/` to the API | 5173 → 80 |
| `api` | built from `server/Dockerfile` (Node 22) | REST API using restricted `sams_app` credentials | 3000 |
| `migrate` | same server image | One-shot migrations and role provisioning | internal |
| `retention` | same server image | Scheduled data retention with a separate DB role | internal |
| `postgres` | `postgres:15` | Main database (volume `pgdata`) | internal |
| `redis` | `redis:7-alpine` | QR check-in windows, nonces and check-in locks | internal |

## Prerequisites
- Docker and Docker Compose
- Node.js 22.12+ (only for running without Docker)
- Git

## Run with Docker
```bash
git clone https://github.com/melwarebytes/MiniProject_TeamE1_AttendanceSystem
cd MiniProject_TeamE1_AttendanceSystem
cp .env.example .env              # set JWT_SECRET, QR_HMAC_SECRET, APP_DB_PASSWORD and RETENTION_DB_PASSWORD
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
cd server
cp .env.example .env  # configure local PostgreSQL and Redis URLs
npm ci
npx prisma generate
npm run migrate:deploy
npm run seed
npm run dev
# In a second terminal from the repository root:
cd client && npm ci && npm run dev      # http://localhost:5173, proxies /api to :3000
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
- PostgreSQL, Redis and the API have Docker health checks; long-running services use `restart: unless-stopped`, so a crashed container is restarted automatically. The client waits for a healthy API, and the API waits for healthy Postgres and Redis.
- The API shuts down gracefully on `SIGTERM` (finishes in-flight requests, then closes database and Redis connections).
- For uptime monitoring (99.5% target), point any HTTP monitor at the health URL with a 1-minute interval.

## Backup and restore (NFR-04)
| Script | What it does |
|---|---|
| [`ops/backup.sh`](../ops/backup.sh) | `pg_dump` of the `sams` database → `backups/sams_<timestamp>.sql.gz`; deletes backups older than 30 days. Set `BACKUP_PASSPHRASE` to encrypt with AES-256 (SR-03). |
| [`ops/restore.sh`](../ops/restore.sh) | Stops the API and retention worker, restores a chosen backup, starts the API and waits for health before restarting retention. Asks you to type `RESTORE` first. |

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

## Versioned migrations and restricted database accounts

The Compose `migrate` service runs before the API. It uses the database owner to
apply migrations and provision `sams_app` and `sams_retention`. Set URL-safe
`APP_DB_PASSWORD` and `RETENTION_DB_PASSWORD` (16+ characters) in `.env`.
The API uses `sams_app`, which can read/append audit entries but cannot update,
delete or truncate them. The separate retention worker uses `sams_retention`;
a database trigger prohibits deleting audit entries younger than three years.
Do not use the migration owner as the runtime `DATABASE_URL`.

For an **existing installation created with `prisma db push`**, back up first,
compare the database to the initial migration, and baseline the already-existing
schema once (using the owner connection):

```bash
cd server
npx prisma migrate resolve --applied 20261027000000_initial
npm run migrate:deploy
npm run db:roles
```

Use `migrate resolve` only if the existing schema matches the initial migration.
A new empty database needs only `npm run migrate:deploy`, never a baseline.
`npm run seed` is repeatable and creates demo Admin, Faculty and Student accounts.

The retention worker runs daily at 02:30 Asia/Kolkata. It anonymises students only
when **every enrolled semester ended more than two years ago**; accounts without
an enrolment are skipped because no retention end can be inferred. Credentials,
reset/refresh tokens, leave text and attachments, alerts and personal profile
fields are removed. Attendance aggregates retain opaque IDs. Audit history is
kept under the separate three-year rule and is never rewritten. Failures are
logged; the next nightly run retries. A database advisory lock prevents two
workers from performing the same cleanup concurrently.

## Admin and report screens

Admins have Users, Courses & Enrolments, Reports and Policy pages. CSV headers are
`name,email,role,srn,department`, with optional `password,active`. The default email
domain is `pes.edu`; configure `INSTITUTION_EMAIL_DOMAIN` for another institution.
Existing email addresses update accounts; new accounts without a password must
use Forgot password. Student SRNs are required. `active` is `true` or `false`.
Errors identify physical CSV line numbers while valid records still import.

Roster changes are effective at the time they are saved; past rosters remain
intact. Remove a student from their old section before enrolling them in another
section of the same course/semester. Global policy updates apply to all sections;
the QR default is 1–10 minutes, as required by FR-07. Holidays affect timetable
session generation, without cancelling previously scheduled sessions.

Faculty reports are restricted to their assigned sections. Each generated report
has a user-bound 15-minute snapshot; CSV/PDF exports read that exact snapshot so
subsequent attendance edits cannot silently change downloaded figures. Regenerate
an expired report to export again. Cancelled sessions are excluded and EXCUSED
counts as attended, matching SADS §8.2.

## Repeatable release drill

The CI deployment job builds fresh images, starts an isolated Compose project,
checks database/Redis/proxy health, runs the seed twice and compares row counts,
backs up, changes a sentinel value, restores, and verifies both counts and data.
It stops both API and retention writers during restore. A failed restore keeps
them stopped. The `sprint-release-evidence` artifact contains the drill logs,
counts, health JSON, screenshots, report downloads and browser recordings from
the real API. The CI database contains demo data only and is destroyed afterward.

Pilot rollout still needs a deployment hostname, TLS termination, real secrets,
SMTP configuration and a host backup schedule. Set `COOKIE_SECURE=true` behind
HTTPS. Run the load test on the pilot's specified 4-vCPU/8-GB host and record its
results before admitting real students. Existing-database baseline checks above
remain required; the fresh-database CI drill does not validate an unknown existing database.
