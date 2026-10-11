# Work Breakdown Structure — SAMS

Effort is in story points on the Fibonacci scale (1, 2, 3, 5, 8). Implementation work packages map one-to-one to GitHub issues on the project board.

## WBS Hierarchy

```
1. SAMS Release 1.0
├── 1.1 Requirements Engineering        (Deliverables Part 1 — done)
│   ├── 1.1.1 Elicit and specify FR, NFR, SR
│   ├── 1.1.2 Use case model
│   └── 1.1.3 SRS document (SAMS-SRS-01)
├── 1.2 Architecture and Design         (Deliverables Part 1 — done)
│   ├── 1.2.1 Architectural pattern and component design
│   ├── 1.2.2 Data, API and security design
│   └── 1.2.3 Sequence diagrams; SADS document (SAMS-SADS-01)
├── 1.3 Test Planning                   (Deliverables Part 1 — done)
│   ├── 1.3.1 Test plan (SAMS-STP-01) and RTM
│   └── 1.3.2 Test case specification (18 test cases)
├── 1.4 Project Setup                   (12 Oct)
│   ├── 1.4.1 GitHub Project, backlog, story points, assignment
│   └── 1.4.2 Sprint dry run (12–16 Oct)
├── 1.5 Sprint 1 Implementation        (19–23 Oct)
│   ├── 1.5.1 SETUP-01 Project scaffolding: React SPA, Express API, PostgreSQL + Redis via Docker Compose [3 SP]
│   ├── 1.5.2 SETUP-02 GitHub Actions CI: lint and test on every pull request [2 SP]
│   ├── 1.5.3 SETUP-03 Database schema and migrations [3 SP]
│   ├── 1.5.4 FR-01 User authentication and role-based access [5 SP]
│   ├── 1.5.5 FR-02 Password reset [3 SP]
│   ├── 1.5.6 FR-03 User management with bulk CSV import [5 SP]
│   ├── 1.5.7 FR-04 Course, section and enrolment management [5 SP]
│   ├── 1.5.8 FR-05 Class session scheduling from timetable [5 SP]
│   ├── 1.5.9 FR-06 Manual attendance marking [5 SP]
│   └── 1.5.10 FR-09 Student attendance dashboard [3 SP]
├── 1.6 Sprint 2 Implementation        (26–30 Oct)
│   ├── 1.6.1 FR-07 QR-code self check-in with rotating tokens [8 SP]
│   ├── 1.6.2 FR-08 Attendance correction with admin approval [5 SP]
│   ├── 1.6.3 FR-10 Leave / excused absence requests [5 SP]
│   ├── 1.6.4 FR-11 Low-attendance alerts [3 SP]
│   ├── 1.6.5 FR-12 Reports and CSV/PDF export [5 SP]
│   ├── 1.6.6 FR-13 Audit log viewer (read-only) [3 SP]
│   ├── 1.6.7 FR-14 Attendance policy configuration [2 SP]
│   ├── 1.6.8 NFR-01 Performance and burst-load testing [3 SP]
│   ├── 1.6.9 NFR-03 Deployment, health checks and backup/restore [3 SP]
│   ├── 1.6.10 NFR-05 Usability, accessibility and browser compatibility [3 SP]
│   └── 1.6.11 NFR-09 Data retention job [1 SP]
├── 1.7 Testing and Bug Fixing         (continuous, via CI)
│   ├── 1.7.1 Execute test cases TC-01 to TC-18
│   └── 1.7.2 AI-assisted bug fix / patch / retest
├── 1.8 Deployment                      (Sprint 2)
│   └── 1.8.1 Docker Compose environment, setup guide
└── 1.9 Documentation and Demo
    ├── 1.9.1 Sprint 1 demo video (1 min)
    ├── 1.9.2 Sprint 2 demo video (2 min)
    └── 1.9.3 Final documentation, deviations log, freeze
```

## Sprint 1 (2026-10-19 to 2026-10-23)

**Goal:** Working core: log in by role, admin sets up users/courses/sessions, faculty marks attendance manually, student sees their dashboard.

| ID | Work package | Priority | SP | Owner | Traces to |
|---|---|---|---|---|---|
| SETUP-01 | Project scaffolding: React SPA, Express API, PostgreSQL + Redis via Docker Compose | High | 3 | Merull Shah | SADS §2–3, SR-08 |
| SETUP-02 | GitHub Actions CI: lint and test on every pull request | High | 2 | Merull Shah | NFR-08, STP §5 |
| SETUP-03 | Database schema and migrations | High | 3 | N S Raj Nanjappa | SADS §8, SR-06 |
| FR-01 | User authentication and role-based access | High | 5 | Merull Shah | FR-01, SR-01–SR-04, SR-07, TC-01, TC-02, TC-16 |
| FR-02 | Password reset | Medium | 3 | Merull Shah | FR-02, SR-07, TC-16 |
| FR-03 | User management with bulk CSV import | High | 5 | N S Raj Nanjappa | FR-03, TC-03 |
| FR-04 | Course, section and enrolment management | High | 5 | N S Raj Nanjappa | FR-04 |
| FR-05 | Class session scheduling from timetable | High | 5 | N Bhuvan Teja | FR-05 |
| FR-06 | Manual attendance marking | High | 5 | N Bhuvan Teja | FR-06, SR-02, TC-04, TC-05 |
| FR-09 | Student attendance dashboard | High | 3 | N Bhuvan Teja | FR-09, TC-09 |
| | **Total** | | **39** | | |

Load: Merull Shah 13 SP, N S Raj Nanjappa 13 SP, N Bhuvan Teja 13 SP

## Sprint 2 (2026-10-26 to 2026-10-30)

**Goal:** Complete release 1.0: QR check-in, corrections, leave, alerts, reports, audit log, policies, and the non-functional checks.

| ID | Work package | Priority | SP | Owner | Traces to |
|---|---|---|---|---|---|
| FR-07 | QR-code self check-in with rotating tokens | High | 8 | Merull Shah | FR-07, SR-05, TC-06, TC-07 |
| FR-08 | Attendance correction with admin approval | High | 5 | N Bhuvan Teja | FR-08, SR-06, TC-08 |
| FR-10 | Leave / excused absence requests | Medium | 5 | N Bhuvan Teja | FR-10, SR-08, TC-10 |
| FR-11 | Low-attendance alerts | Medium | 3 | N Bhuvan Teja | FR-11, TC-11 |
| FR-12 | Reports and CSV/PDF export | High | 5 | N S Raj Nanjappa | FR-12, TC-12 |
| FR-13 | Audit log viewer (read-only) | Medium | 3 | Merull Shah | FR-13, SR-06, TC-17 |
| FR-14 | Attendance policy configuration | Low | 2 | N S Raj Nanjappa | FR-14 |
| NFR-01 | Performance and burst-load testing | High | 3 | N S Raj Nanjappa | NFR-01, NFR-02, TC-13, TC-14 |
| NFR-03 | Deployment, health checks and backup/restore | Medium | 3 | Merull Shah | NFR-03, NFR-04 |
| NFR-05 | Usability, accessibility and browser compatibility | Medium | 3 | N S Raj Nanjappa | NFR-05, NFR-06, NFR-07, TC-18 |
| NFR-09 | Data retention job | Low | 1 | N S Raj Nanjappa | NFR-09, SR-06 |
| | **Total** | | **41** | | |

Load: Merull Shah 14 SP, N S Raj Nanjappa 14 SP, N Bhuvan Teja 13 SP
