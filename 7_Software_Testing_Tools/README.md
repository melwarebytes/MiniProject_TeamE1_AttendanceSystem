# 7 · Software Testing Tools

## Executed automation

The checks on [PR #26](https://github.com/melwarebytes/MiniProject_TeamE1_AttendanceSystem/pull/26)
are the authoritative results for the current revision. The server suite uses
PostgreSQL 15 and Redis 7. Playwright page fixtures isolate UI behavior; the
separate deployment/demo job uses the real Docker API and database.

| Tool | Purpose |
|---|---|
| Jest + Supertest | API authorization, imports, attendance, corrections, leave, alerts, reports, retention and audit protection |
| Node.js load runner | 500 concurrent users, 300 QR check-ins over 60 seconds, 200-student roster |
| Playwright + axe-core | Chromium, Chrome, Edge, Firefox, WebKit; 360/1920 px; keyboard marking, accessibility and stored-XSS regression |
| Selenium + native SafariDriver | Actual Apple Safari on macOS; both widths, axe-core and keyboard marking |
| Docker Compose + shell | Fresh deployment, repeat seed counts, health/proxy checks and backup/restore |
| Playwright real-API demo | Three-role login, 12 screens, screenshots/video and CSV/PDF downloads |

## Test-case evidence map

Case definitions: [SAMS Test Cases](../2_Test_Planning/SAMS%20Test%20Cases.docx).
A passing automated check establishes the behavior listed here; it does not
stand in for manual release checks or penetration testing.

| Case | Automated evidence | Remaining verification |
|---|---|---|
| TC-01 Login | `auth.test.js`: credentials, role, 15-minute token, audit | — |
| TC-02 Lockout | `auth.test.js`: five failures and locked-account denial | — |
| TC-03 CSV import | `admin.test.js`: 5,000 valid users, partial failures, physical row numbers, limits | — |
| TC-04 Manual marking | `sprint.test.js`: assigned faculty saves roster; load test submits 200 students | — |
| TC-05 Section isolation | `sprint.test.js`: other faculty denied; report/export revocation tests | — |
| TC-06 QR success | `qr.test.js`: enrolled student recorded PRESENT/QR | Live two-device classroom demo |
| TC-07 QR rejection | `qr.test.js`: expired, tampered, duplicate and closed-window tokens | — |
| TC-08 Corrections | Edit-window unit tests; API rejects expired direct edit, enforces admin approval, persists/audits correction | — |
| TC-09 Percentages | Unit calculation cases and SQL view/report aggregate assertions | — |
| TC-10 Attachments | Spoofed MIME rejected, >5 MB rejected, valid signature accepted, private download and leave review | File-signature checks are not malware scanning |
| TC-11 Alerts | Concurrent checks produce one in-app alert; seven-day suppression; scheduled five-minute evaluation | Real SMTP delivery latency requires configured mail service |
| TC-12 Exports | Snapshot figures survive mark changes; CSV/PDF download; rendered multi-page PDF inspection | — |
| TC-13 API load | 500 simultaneous users, 5,000 requests; p95 ≤2 s, p99 ≤4 s, zero-error gate | Repeat on actual 4-vCPU/8-GB pilot host |
| TC-14 QR burst | 300 distinct check-ins at 5/second over 60 seconds; <0.5% error gate | Repeat on pilot host |
| TC-15 SQL/XSS | SQL-shaped login rejected; student markup displayed as text in every Playwright target | These are regression cases, not a comprehensive security audit |
| TC-16 Transport/tokens | Expired tokens rejected; secure/HttpOnly/SameSite cookie assertions | Deployed HTTPS certificate, redirects and headers need actual hostname |
| TC-17 Audit integrity | Mutation endpoints denied; runtime SQL UPDATE/DELETE/TRUNCATE denied; retention boundary enforced | — |
| TC-18 Accessibility | Axe-core key pages, keyboard-only marking, 360/1920 px across five targets plus native Safari | Manual screen reader/zoom/touch, iOS, previous-major browser versions, faculty usability survey |

## AI-assisted fixes and retests

All changes below are in PR #26, with tests rerun in CI after each correction.
The user request to Codex was to fix Raj's assigned issues and complete the sprint.

| Finding | Fix | Regression evidence |
|---|---|---|
| Keyboard-inaccessible scroll regions and low-contrast controls | Focusable named table regions, labels, visible focus and darker colors | Axe and keyboard suite |
| Historical roster membership lost after transfers | Enrollment periods and semester-aware duplicate prevention | API concurrency and eligibility tests |
| Export values could change after viewing | User-bound report snapshot, permission recheck on download | CSV/PDF snapshot tests |
| Faculty scheduling/leave/alert actions insufficiently scoped | Assigned-section authorization and scoped queries | Sprint API tests |
| Leave upload trusted MIME and public file URLs | Signature validation and authenticated document endpoint | Spoofed/oversized/private-download tests |
| Session regeneration duplicated classes | Section lock and existing-session comparison | Repeat-generation test |
| Concurrent checks could duplicate low-attendance alerts | Per-student/course transaction lock and seven-day check | Concurrent alert test |
| Repeated demo seeding added sessions | Reuse dated sessions and upsert attendance | Deployment seed-count comparison |
| Restore left another database writer running | Stop API and retention, restart after successful restore | Disposable restore drill |

## Release handoff

The repository's contributing rule requires a repository-owner review before
merge. The eight Raj issues close through PR #26 when it is merged. Do not close
them manually while the changes remain unmerged. The manual/external items in
the table remain unverified until the team records actual results.
