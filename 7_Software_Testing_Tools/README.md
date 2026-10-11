# 7 · Software Testing Tools

## Tools
| Tool | Purpose | Requirement / test case |
|---|---|---|
| Jest + Supertest | Unit and API integration tests (server) | TC-01 – TC-12, TC-15 – TC-17 |
| Vitest + React Testing Library | Component tests (client) | — |
| k6 | Load and burst testing | TC-13, TC-14 (NFR-01, NFR-02) |
| axe-core | Accessibility scan | TC-18 (NFR-07) |
| GitHub Actions | Runs lint and tests on every pull request | NFR-08 |

## AI-assisted bug fix, patch and retest
Record each bug found, how it was fixed with an AI tool, and the retest result.

| # | Bug | Found by (test case) | AI tool and prompt | Fix (PR) | Retest result |
|---|---|---|---|---|---|
| 1 | | | | | |

## Test execution summary
Case definitions: [SAMS Test Cases](../2_Test_Planning/SAMS%20Test%20Cases.docx). Update Status (Pass / Fail / Blocked) after each run.

| Test case | Title | Type | Requirement(s) | Status | Executed by / date | Notes |
|---|---|---|---|---|---|---|
| TC-01 | Login with valid credentials | Functional | FR-01 | Not run | | |
| TC-02 | Account lockout after repeated failures | Security | FR-01, SR-04, SR-06 | Not run | | |
| TC-03 | Bulk CSV user import with invalid rows | Functional | FR-03 | Not run | | |
| TC-04 | Manual attendance marking by assigned faculty | Functional | FR-06 | Not run | | |
| TC-05 | Faculty cannot mark another faculty's section | Security | FR-06, SR-02 | Not run | | |
| TC-06 | Successful QR check-in | Functional | FR-07 | Not run | | |
| TC-07 | Reject expired, replayed and duplicate QR tokens | Security | FR-07, SR-05 | Not run | | |
| TC-08 | Attendance correction inside and outside edit window | Functional | FR-08, SR-06 | Not run | | |
| TC-09 | Attendance percentage calculation | Functional | FR-09 | Not run | | |
| TC-10 | Leave request with invalid attachment | Functional | FR-10, SR-08 | Not run | | |
| TC-11 | Low-attendance alert and throttling | Functional | FR-11 | Not run | | |
| TC-12 | Report export matches on-screen data | Functional | FR-12 | Not run | | |
| TC-13 | API response time under load | Non-functional | NFR-01 | Not run | | |
| TC-14 | Burst QR check-in load | Non-functional | NFR-02, SR-05 | Not run | | |
| TC-15 | SQL injection and XSS resistance | Security | SR-08, SR-02 | Not run | | |
| TC-16 | Transport security and token expiry | Security | SR-03, SR-07 | Not run | | |
| TC-17 | Audit log immutability | Security | SR-06, FR-13 | Not run | | |
| TC-18 | Accessibility and responsive layout | Non-functional | NFR-06, NFR-07 | Not run | | |
