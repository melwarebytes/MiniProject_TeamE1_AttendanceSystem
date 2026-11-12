# 9 · Sprint demo

## Sprint videos

| Video | Length | Contents |
|---|---|---|
| [Sprint1_Demo.mp4](Sprint1_Demo.mp4) | 71 s | Sprint 1 outcome. Role-based login (FR-01), password reset (FR-02), user management and CSV import (FR-03), courses and enrolments (FR-04), timetable and extra session (FR-05), manual marking (FR-06), student dashboard (FR-09). Ends with the bugs fixed in the sprint review (PR #27). |
| [Sprint2_Demo.mp4](Sprint2_Demo.mp4) | 109 s | Merull Shah's Sprint 2 items. QR check-in on a split screen with faculty and student, including replay and tampered-code rejections (#12 FR-07, SR-05). Audit log search with IST date filters (#17 FR-13). Health endpoint and backup/restore drill (#20 NFR-03/04). Ends with the bugs fixed (PR #28). |

Both videos are recorded against the running Docker Compose stack with the real API and database. To re-record one, run this from `client/` against a running stack:
`node e2e/sprint-demo.mjs 1|2 <scratchDir>`. Optional variables are listed at the top of the script.

## Screenshots

Frames from the two videos, in `screenshots/`:

| Sprint 1 | Sprint 2 |
|---|---|
| [Login (FR-01)](screenshots/s1_01_login_FR-01.png) | [QR window open (FR-07)](screenshots/s2_01_qr_window_FR-07.png) |
| [User CSV import (FR-03)](screenshots/s1_02_users_csv_FR-03.png) | [Student checked in (FR-07)](screenshots/s2_02_qr_checked_in_FR-07.png) |
| [Enrolment (FR-04)](screenshots/s1_03_enrolment_FR-04.png) | [Duplicate check-in rejected (SR-05)](screenshots/s2_03_qr_duplicate_rejected_SR-05.png) |
| [Extra session (FR-05)](screenshots/s1_04_extra_session_FR-05.png) | [Tampered code rejected (SR-05)](screenshots/s2_04_qr_tampered_rejected_SR-05.png) |
| [Manual marking (FR-06)](screenshots/s1_05_marking_FR-06.png) | [Audit log (FR-13)](screenshots/s2_05_audit_log_FR-13.png) |
| [Student dashboard (FR-09)](screenshots/s1_06_student_dashboard_FR-09.png) | [Audit entry detail (FR-13)](screenshots/s2_06_audit_detail_FR-13.png) |
| | [Backup and restore drill (NFR-03)](screenshots/s2_07_backup_restore_NFR-03.png) |

## CI evidence


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
