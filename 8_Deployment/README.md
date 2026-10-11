# 8 · Deployment, Infrastructure and Environment Setup

## Architecture
Three-tier web application (see [4_Architecture_and_Design](../4_Architecture_and_Design/)): React SPA → Node.js 20 / Express API → PostgreSQL 15 and Redis 7, run as Docker containers behind Nginx.

> Ports, scripts and variables below match the planned setup (SETUP-01); update them once the code is in.

## Prerequisites
- Docker and Docker Compose
- Node.js 20 LTS (only for running without Docker)
- Git

## Run locally
```bash
git clone https://github.com/melwarebytes/Student-Attendance-Management-System
cd Student-Attendance-Management-System
cp .env.example .env        # fill in secrets
docker compose up --build
```
| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| API health check | http://localhost:3000/api/v1/health |

## Environment variables
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Signing key for access tokens |
| `QR_HMAC_SECRET` | Signing key for QR tokens (SR-05) |
| `SMTP_URL` | Email provider for alerts and password reset |

## Database
Migrations and seed data: `npm run migrate` and `npm run seed` in `/server`. Seed accounts are listed in `/server/README.md`.

## CI/CD
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs lint, tests and the client build on every push and pull request to `main`.

## Backup and restore (NFR-04)
To be completed in Sprint 2.
