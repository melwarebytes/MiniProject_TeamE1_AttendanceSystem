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
