# Deviations from submitted documents

Record any change from the SRS (SAMS-SRS-01), SADS (SAMS-SADS-01) or Test Plan (SAMS-STP-01) here, as it happens. This is presented at the final demo.

| Date | Sprint | Document & section | What changed | Why | Raised by |
|------|--------|--------------------|--------------|-----|-----------|
| 27 Oct 2026 | 1 | SADS §2 (technology stack) | Prisma 7 with the `pg` driver adapter instead of Prisma 5 with its native query engine. | Prisma 7 needs no native query-engine binary, which makes the Docker image smaller and avoids engine download problems. Queries and schema are unchanged. | Merull Shah |
| 27 Oct 2026 | 1 | SADS §2, §12.3 (frontend) | Tailwind CSS is compiled at build time instead of loaded from the Tailwind Play CDN. | The CDN script is meant for prototyping only; the built app was unstyled without internet access. | Merull Shah |
| 27 Oct 2026 | 1 | SRS FR-01, SR-07 | The access token lifetime in the example environment file was 1 hour; it is now 15 minutes as specified. Found by TC-01. | Matches SR-07. | Merull Shah |
| 27 Oct 2026 | 1 | SADS §6.2 | The access token is kept in memory in the browser, not in `localStorage`; the session is restored on reload from the HttpOnly refresh cookie. | Tokens in `localStorage` can be read by injected scripts. | Merull Shah |
| 28 Oct 2026 | 2 | SADS §8 (data model) | The unused `QrToken` table was removed. QR windows, nonces and check-in locks are kept in Redis, as SADS §6.4 describes; each attendance record now stores its `source` (MANUAL, QR or LEAVE). | Follows the SADS design; the table had been added as a placeholder. | Merull Shah |
| 28 Oct 2026 | 2 | SRS FR-07 | A QR window can only be opened on the day of the class. | Prevents opening check-in for past or future sessions. | Merull Shah |
| 28 Oct 2026 | 2 | SADS §10.2 (API) | Added `GET /qr/today` (today's classes for the faculty member) and `GET /sessions/{id}/qr` (window status and check-in count). | Needed by the classroom QR screen. | Merull Shah |
| 28 Oct 2026 | 2 | SADS §8.1 / FR-04 | Added enrolment membership periods; section identity includes semester start. | Keeps historical rosters intact during transfers, withdrawal and re-enrolment. | N S Raj Nanjappa |
| 28 Oct 2026 | 2 | SADS §8.2 | Added a live `attendance_percentages` view; dashboard reads remain live rather than using a materialised cache. | Measured CI workload meets response targets without cache invalidation complexity. | N S Raj Nanjappa |
| 28 Oct 2026 | 2 | FR-12 / API §10.2 | Exports require a user-bound report snapshot valid for 15 minutes. | Guarantees downloaded figures match the report displayed before later attendance edits. | N S Raj Nanjappa |
| 28 Oct 2026 | 2 | NFR-09 / SR-06 | Separate retention worker/database role; immutable audit rows follow the separate three-year schedule. | An API credential cannot rewrite audit history or purge it early. | N S Raj Nanjappa |
| 30 Oct 2026 | 2 | Test Plan TC-13/14 | Reproducible Node.js HTTP load runner instead of k6; measured concurrency, latency and burst gates are unchanged. | Runs alongside the application without a separate load-test dependency; workload and host limits are documented. | N S Raj Nanjappa |
| 30 Oct 2026 | 2 | FR-05 / API | Added audited weekly-timetable editing and idempotent session generation; existing sessions remain intact. | New sections can be scheduled from the UI without duplicating or deleting attendance. | N S Raj Nanjappa |
| 30 Oct 2026 | 2 | FR-10 / SR-08 | Leave files require matching signatures and are downloaded through an authorized endpoint. | Prevents MIME spoofing and public access to supporting documents. | N S Raj Nanjappa |
| 30 Oct 2026 | 2 | FR-11 | Five-minute alert evaluation with a transaction lock for each student/course. | Enforces the seven-day throttle during concurrent checks and detects changes within the requested interval. | N S Raj Nanjappa |
| 30 Oct 2026 | 2 | Demo submission | CI publishes real-API WebM walkthroughs and screenshots instead of claiming placeholder MP4 files exist. | Makes automated evidence available while leaving narration and live two-device QR demonstration to the team. | N S Raj Nanjappa |
