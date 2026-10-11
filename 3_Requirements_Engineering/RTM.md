# Requirements Traceability Matrix

From SAMS Test Plan §14. Each backlog issue on GitHub also lists the requirement and test case IDs it traces to.

### Forward Traceability (Requirement → Design → Test)

| **Requirement** | **Design element**               | **Test case(s)**              | **Covered** |
|-----------------|----------------------------------|-------------------------------|-------------|
| FR-01           | Auth Service; SADS §6.2          | TC-01, TC-02                  | Yes         |
| FR-02           | Auth Service; SADS §6.2          | Integration test (reset flow) | Yes         |
| FR-03           | User & Course Service            | TC-03                         | Yes         |
| FR-04           | User & Course Service            | Integration test              | Yes         |
| FR-05           | User & Course Service, Scheduler | Integration test              | Yes         |
| FR-06           | Attendance Service; SD-1         | TC-04, TC-05                  | Yes         |
| FR-07           | QR Session Service; SD-2, §6.4   | TC-06, TC-07                  | Yes         |
| FR-08           | Attendance Service, Audit Logger | TC-08                         | Yes         |
| FR-09           | Attendance Service; §8.2         | TC-09                         | Yes         |
| FR-10           | Leave Service; SD-3              | TC-10                         | Yes         |
| FR-11           | Notification Service, Scheduler  | TC-11                         | Yes         |
| FR-12           | Reporting Service                | TC-12                         | Yes         |
| FR-13           | Audit Logger                     | TC-17                         | Yes         |
| FR-14           | User & Course Service            | Unit test (range validation)  | Yes         |
| NFR-01          | API replicas, DB pool            | TC-13                         | Yes         |
| NFR-02          | QR Service + Redis               | TC-14                         | Yes         |
| NFR-06          | Web SPA / PWA                    | TC-18                         | Yes         |
| NFR-07          | Web SPA / PWA                    | TC-18                         | Yes         |
| SR-01           | Auth Service                     | Unit test (hash cost)         | Yes         |
| SR-02           | API Gateway, services            | TC-05, TC-15                  | Yes         |
| SR-03           | Nginx, data tier                 | TC-16                         | Yes         |
| SR-04           | Auth, API Gateway                | TC-02                         | Yes         |
| SR-05           | QR Session Service               | TC-07, TC-14                  | Yes         |
| SR-06           | Audit Logger                     | TC-02, TC-08, TC-17           | Yes         |
| SR-07           | Auth Service                     | TC-16                         | Yes         |
| SR-08           | API Gateway, Leave Service       | TC-10, TC-15                  | Yes         |

NFR-03, NFR-04, NFR-05, NFR-08 and NFR-09 are verified by the methods in Sections 4 and 5.3 rather than by numbered test cases.

### Backward Traceability (Test → Requirement)

| **Test case** | **Title**                                            | **Type**                                   | **Requirement(s)**  |
|---------------|------------------------------------------------------|--------------------------------------------|---------------------|
| TC-01         | Login with valid credentials                         | Functional                                 | FR-01               |
| TC-02         | Account lockout after repeated failures              | Security                                   | FR-01, SR-04, SR-06 |
| TC-03         | Bulk CSV user import with invalid rows               | Functional                                 | FR-03               |
| TC-04         | Manual attendance marking by assigned faculty        | Functional                                 | FR-06               |
| TC-05         | Faculty cannot mark another faculty's section        | Security                                   | FR-06, SR-02        |
| TC-06         | Successful QR check-in                               | Functional                                 | FR-07               |
| TC-07         | Reject expired, replayed and duplicate QR tokens     | Security                                   | FR-07, SR-05        |
| TC-08         | Attendance correction inside and outside edit window | Functional                                 | FR-08, SR-06        |
| TC-09         | Attendance percentage calculation                    | Functional                                 | FR-09               |
| TC-10         | Leave request with invalid attachment                | Functional                                 | FR-10, SR-08        |
| TC-11         | Low-attendance alert and throttling                  | Functional                                 | FR-11               |
| TC-12         | Report export matches on-screen data                 | Functional                                 | FR-12               |
| TC-13         | API response time under load                         | Non-functional (Performance)               | NFR-01              |
| TC-14         | Burst QR check-in load                               | Non-functional (Scalability)               | NFR-02, SR-05       |
| TC-15         | SQL injection and XSS resistance                     | Security                                   | SR-08, SR-02        |
| TC-16         | Transport security and token expiry                  | Security                                   | SR-03, SR-07        |
| TC-17         | Audit log immutability                               | Security                                   | SR-06, FR-13        |
| TC-18         | Accessibility and responsive layout                  | Non-functional (Usability / Accessibility) | NFR-06, NFR-07      |

### Coverage Summary

| **Category**         | **Total** | **Covered by test cases**                  | **Covered by other methods** |
|----------------------|-----------|--------------------------------------------|------------------------------|
| Functional (FR)      | 14        | 10                                         | 4                            |
| Non-functional (NFR) | 9         | 4                                          | 5                            |
| Security (SR)        | 8         | 7                                          | 1                            |
| Test cases           | 18        | 9 functional, 3 non-functional, 6 security | —                            |
