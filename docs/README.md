# Project reports

Index of every report and piece of evidence for release 1.0 of SAMS. Development is frozen at commit `b662711` (12 Nov 2026).

## Requirements and design (Part 1)

| Report | Location |
|---|---|
| Software Requirements Specification (IEEE 830) | [SAMS SRS.docx](../1_SRS_and_WBS/SAMS%20SRS.docx) |
| Work Breakdown Structure and story points | [Work_Breakdown_Structure.md](../1_SRS_and_WBS/Work_Breakdown_Structure.md) |
| Functional and non-functional requirements | [3_Requirements_Engineering](../3_Requirements_Engineering/) |
| Requirements Traceability Matrix | [RTM.md](../3_Requirements_Engineering/RTM.md) |
| Software Architecture and Design Specification | [SAMS Architecture Design Spec.docx](../4_Architecture_and_Design/SAMS%20Architecture%20Design%20Spec.docx) |
| API design | [API_Design.md](../4_Architecture_and_Design/API_Design.md) |
| Use case, component and sequence diagrams | [diagrams](../4_Architecture_and_Design/diagrams/) |

## Planning and sprints (Part 2)

| Report | Location |
|---|---|
| Backlog source (21 items, story points, owners, sprints) | [backlog.json](../5_Project_Setup_Screenshots/backlog/backlog.json) |
| Repository, issues, milestones, PRs and Actions screenshots | [5_Project_Setup_Screenshots](../5_Project_Setup_Screenshots/) |
| Sprint 1 and Sprint 2 videos and screenshots | [9_Demo](../9_Demo/) |
| Deviations from the submitted documents | [DEVIATIONS.md](../DEVIATIONS.md) |

## Testing (Part 3)

| Report | Location |
|---|---|
| Test Plan (IEEE 829), with results in Section 15 | [SAMS Test Plan.docx](../2_Test_Planning/SAMS%20Test%20Plan.docx) |
| Test Case Specification and execution log (18/18 pass) | [SAMS Test Cases.docx](../2_Test_Planning/SAMS%20Test%20Cases.docx) |
| Tools, test-case evidence map and bugs fixed per sprint | [7_Software_Testing_Tools](../7_Software_Testing_Tools/README.md) |
| Load test method and limits | [server/performance](../server/performance/README.md) |
| Deployment and restore drill log | [8_Deployment](../8_Deployment/README.md) |
| CI run for the frozen build (tests, load results, browser and deployment checks) | [Actions run 43271107200](https://github.com/melwarebytes/MiniProject_TeamE1_AttendanceSystem/actions/runs/43271107200) |

## Results for build b662711

| Check | Result |
|---|---|
| Server tests (Jest + Supertest) | 54/54 pass |
| Browser tests (Playwright: Chromium, Chrome, Edge, Firefox, WebKit) | 170 pass |
| Native Safari (macOS) | All 15 pages pass at 360 and 1920 px |
| API load: 500 users, 5,000 requests | 0 errors, p95 1,282 ms, p99 1,394 ms (target p95 ≤ 2 s) |
| QR burst: 300 check-ins in 60 s | 0 errors, p95 24 ms |
| 200-student roster submit | 97 ms (target ≤ 3 s) |
| Backup and restore drill | Pass, 18 s (12 Nov 2026) |
