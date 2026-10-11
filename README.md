# Student Attendance Management System (SAMS)

Software Engineering Mini-Project · PES University, Bengaluru

SAMS is a web-based attendance system. Faculty take attendance from a roster or a rotating QR code, students track their own attendance and request leave, and administrators get reports and a tamper-evident audit trail.

## Team

| Name | SRN | GitHub | Role |
|---|---|---|---|
| Merull Shah | PES1UG24CS270 | [melwarebytes](https://github.com/melwarebytes) | Repository owner · authentication, QR check-in, CI |
| N S Raj Nanjappa | PES1UG24CS287 | — | Admin modules, reports, performance testing |
| N Bhuvan Teja | PES1UG24CS286 | — | Attendance marking, dashboard, leave and alerts |

## Features
- Role-based login for Admin, Faculty and Student
- Manual roster marking and rotating, signed QR-code check-in
- Attendance corrections with an approval workflow
- Student dashboard showing percentage and classes that can still be missed
- Leave requests with document upload
- Low-attendance email and in-app alerts
- Reports with CSV/PDF export, and a read-only audit log

## Tech Stack
React · Node.js 20 / Express · PostgreSQL 15 · Redis 7 · Docker · GitHub Actions

## Repository Structure

| Folder | Contents |
|---|---|
| [1_SRS_and_WBS](1_SRS_and_WBS/) | Software Requirements Specification and Work Breakdown Structure |
| [2_Test_Planning](2_Test_Planning/) | Test Plan and Test Case Specification |
| [3_Requirements_Engineering](3_Requirements_Engineering/) | Functional and non-functional requirements, RTM |
| [4_Architecture_and_Design](4_Architecture_and_Design/) | Architecture pattern, use case, component and sequence diagrams, API design |
| [5_Project_Setup_Screenshots](5_Project_Setup_Screenshots/) | GitHub Project, backlog and sprint screenshots |
| [6_Copilot_Generated_Code](6_Copilot_Generated_Code/) | AI-generated code screenshots and repository link |
| [7_Software_Testing_Tools](7_Software_Testing_Tools/) | Testing tools, AI-assisted bug fix and retest |
| [8_Deployment](8_Deployment/) | Deployment steps, infrastructure, environment setup |
| [9_Demo](9_Demo/) | Sprint demo videos and output screenshots |
| `client/`, `server/` | Application source code |

## Getting Started
See [8_Deployment](8_Deployment/README.md) for full setup steps.
```bash
docker compose up --build
```

## Sprints
| Sprint | Dates | Goal |
|---|---|---|
| Dry run | 12–16 Oct 2026 | Practise branch → PR → review → merge |
| Sprint 1 | 19–23 Oct 2026 | Login, admin setup, manual marking, student dashboard |
| Sprint 2 | 26–30 Oct 2026 | QR check-in, corrections, leave, alerts, reports, audit log |

Backlog and story points: [Work Breakdown Structure](1_SRS_and_WBS/Work_Breakdown_Structure.md) and the GitHub Project linked to this repository.

## Contributing
Each backlog item is a GitHub issue. Work on a branch named after the issue, then open a pull request containing `Closes #<issue>`. CI must pass and the repository owner reviews before merge. Record any deviation from the submitted documents in [DEVIATIONS.md](DEVIATIONS.md).
