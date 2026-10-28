# Performance acceptance: NFR-01 / NFR-02

Run `npm run test:load` in `server/` with `NODE_ENV=test`,
`LOAD_TEST_ALLOW_SEED=1`, a **disposable** PostgreSQL `DATABASE_URL`, Redis
`REDIS_URL`, and `JWT_SECRET`. Run migrations and generate Prisma first.
`TEST_APP_DATABASE_URL` selects the restricted application role for the API.
The script starts and stops its own API on port 3107; it never targets a remote
service. Seeded load data remains in the disposable database for inspection.

The workflow runs against PostgreSQL 15 and Redis 7 and uploads JSON results.
`results/latest.json` is a measured run, including source commit, time and host
resources. It is not a production capacity guarantee: rerun on the pilot's
4-vCPU / 8-GB deployment before rollout.

Workloads:

- 500 simultaneous authenticated users, 10 requests each, alternating profile
  and student-dashboard reads, with 500 students, 30 past sessions and 15,000
  attendance records. Gate: no errors, p95 ≤ 2,000 ms, p99 ≤ 4,000 ms.
- 300 distinct students check in at 5/second for 60 seconds using a real signed
  QR code rotated every 10 seconds. Gate: fewer than 0.5% errors.
- A 200-student attendance submission must return 200 within 3,000 ms.

Durations include client HTTP/JSON handling, so they conservatively bound server
response time. Authentication uses signed test access tokens; password hashing
and login are deliberately excluded. API rate limiting is disabled because all
virtual users share one generator IP; production limits remain unchanged.
Failures produce nonzero exit status, and artifacts are uploaded even on failure.
