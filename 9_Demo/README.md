# 9 · Sprint demo

The **Deployment (Compose, seed, restore, live demo)** CI job publishes the
`sprint-release-evidence` artifact on [PR #26](https://github.com/melwarebytes/MiniProject_TeamE1_AttendanceSystem/pull/26).
Download it from the successful workflow run. The `demo/` directory contains
three WebM browser recordings, screenshots for 12 screens, the actual CSV/PDF
report downloads, and `checks.json`. These use the real API and freshly seeded
PostgreSQL database; no API fixtures are used. All accounts/data are disposable.

| Role | Recorded screens |
|---|---|
| Admin | Users, courses, policies, reports with CSV/PDF export, audit log |
| Faculty | Sessions with weekly timetable, roster, corrections, defaulters |
| Student | Attendance dashboard, leave requests, QR check-in |

The recordings are automated screen walkthroughs. They are not narrated,
fixed-duration Sprint 1 / Sprint 2 presentation videos. For the live presentation:

1. Log in as admin and show user import, course roster and policy settings.
2. Log in as assigned faculty, generate sessions and mark today's roster.
3. Open a QR window and use a student account on a second browser/device to check in.
4. Submit a leave request, review it, and show the corresponding audit entry.
5. Display a report and compare its downloaded CSV/PDF totals.
6. Show the successful CI checks, performance JSON and backup/restore evidence.

Demo credentials are listed by `npm run seed`; never enable them on a real deployment.
