# Functional Requirements

14 functional requirements. Inputs, outputs and acceptance criteria for each are in SRS §4.2.

| ID | Requirement | Priority | Specification |
|---|---|---|---|
| FR-01 | User Authentication | High | The system shall authenticate users by institutional email and password and, on success, issue a signed access token (JWT) that carries the user's ID and role (ADMIN, FACULTY or STUDENT). |
| FR-02 | Password Reset | Medium | The system shall let a user reset a forgotten password through a single-use reset link emailed to their registered address. The link shall expire 15 minutes after it is issued. |
| FR-03 | User Management | High | The system shall allow an Admin to create, update, deactivate and reactivate Student and Faculty accounts, individually or by uploading a CSV file of up to 5,000 rows. |
| FR-04 | Course, Section & Enrolment Management | High | The system shall allow an Admin to create courses and sections for a semester, assign one or more Faculty to each section, and enrol Students in sections. |
| FR-05 | Class Session Scheduling | High | The system shall generate class sessions for each section from a weekly timetable (day, start time, end time, room) between the semester start and end dates, and shall let the assigned Faculty add one-off extra sessions or cancel a session with a reason. |
| FR-06 | Manual Attendance Marking | High | The system shall display the roster for a session with every student defaulted to PRESENT and let the assigned Faculty set each student to PRESENT, ABSENT or LATE and submit the whole roster in one action. |
| FR-07 | QR-Code Self Check-in | High | The system shall let Faculty open a QR check-in window of 1 to 10 minutes for an ongoing session. During the window the classroom screen shall show a QR code that is replaced every 30 seconds, and an enrolled Student who scans it with the logged-in student app shall be marked PRESENT. |
| FR-08 | Attendance Correction | High | The system shall allow the assigned Faculty to change an attendance record within the configured edit window (default 48 hours after the session ends). After the window closes, a change shall require the Faculty to submit a correction request with a reason, which an Admin approves or rejects. |
| FR-09 | Student Attendance Dashboard | High | The system shall show a Student, for every enrolled course, the number of sessions held, attended, absent and excused, the attendance percentage, and the number of further sessions they can miss while staying at or above the threshold. |
| FR-10 | Leave / Excused Absence Requests | Medium | The system shall let a Student submit a leave request for a date range no more than 30 days in the past, with an optional supporting document (PDF, JPG or PNG, max 5 MB). Faculty of the affected courses shall approve or reject it; on approval, ABSENT records in the range shall change to EXCUSED. |
| FR-11 | Low-Attendance Alerts | Medium | The system shall notify a Student, by email and in-app, when their attendance in any course falls below the configured threshold (default 75%). Alerts for the same course shall be sent at most once every 7 days. |
| FR-12 | Reports & Export | High | The system shall generate attendance reports by section, course, student or department over a date range, and shall export them as CSV and PDF. |
| FR-13 | Audit Log Viewing | Medium | The system shall let an Admin search and filter the audit log by actor, action type, entity and date range. |
| FR-14 | Policy Configuration | Low | The system shall let an Admin configure the attendance threshold (50–100%), the edit window (0–168 hours), the default QR window length and the institution holiday list. |
