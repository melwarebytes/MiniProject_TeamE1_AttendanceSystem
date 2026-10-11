# API Design

### Conventions

- Base URL https://sams.\<institution\>/api/v1; JSON request and response bodies; UTF-8.

- Authentication: Authorization: Bearer \<access JWT\> on every endpoint except /auth/login, /auth/refresh and /auth/password-reset/\*.

- Resource names are plural nouns; HTTP methods carry meaning (GET read, POST create, PUT replace, PATCH partial update, DELETE remove).

- Lists are paginated with ?page=&size= (default 20, max 100) and return { data: \[...\], page, size, total }.

- Updates to attendance records require the current version (optimistic locking); a mismatch returns 409.

- Version is in the path (/v1); breaking changes create /v2.

### Endpoint Catalogue

*Table 6: REST endpoint catalogue*

| **Method**  | **Path**                         | **Role**       | **Purpose**                                       | **Success**  |
|-------------|----------------------------------|----------------|---------------------------------------------------|--------------|
| POST        | /auth/login                      | Public         | Log in; returns access token, sets refresh cookie | 200          |
| POST        | /auth/refresh                    | Cookie         | Get a new access token                            | 200          |
| POST        | /auth/logout                     | Any            | Revoke refresh token                              | 204          |
| POST        | /auth/password-reset/request     | Public         | Email a reset link                                | 202          |
| POST        | /auth/password-reset/confirm     | Public         | Set new password with reset token                 | 204          |
| GET / POST  | /users                           | Admin          | List / create users                               | 200 / 201    |
| PATCH       | /users/{id}                      | Admin          | Update or deactivate a user                       | 200          |
| POST        | /users/import                    | Admin          | Bulk CSV import (multipart)                       | 200 + report |
| GET / POST  | /courses, /sections              | Admin          | Manage courses and sections                       | 200 / 201    |
| PUT         | /sections/{id}/enrolments        | Admin          | Replace section roster                            | 200          |
| PUT         | /sections/{id}/timetable         | Admin          | Set weekly timetable; generates sessions          | 200          |
| GET         | /faculty/me/sessions?date=       | Faculty        | My sessions for a date                            | 200          |
| PATCH       | /sessions/{id}                   | Faculty        | Cancel session (with reason)                      | 200          |
| GET         | /sessions/{id}/roster            | Faculty        | Roster with current marks                         | 200          |
| PUT         | /sessions/{id}/attendance        | Faculty        | Submit whole roster                               | 200          |
| POST        | /sessions/{id}/qr                | Faculty        | Open QR window                                    | 201          |
| GET         | /sessions/{id}/qr/token          | Faculty        | Get current rotating token                        | 200          |
| DELETE      | /sessions/{id}/qr                | Faculty        | Close QR window early                             | 204          |
| POST        | /checkins                        | Student        | Check in with QR token                            | 201          |
| PATCH       | /attendance/{recordId}           | Faculty        | Correct a record within edit window               | 200          |
| POST        | /corrections                     | Faculty        | Request late correction                           | 201          |
| PATCH       | /corrections/{id}                | Admin          | Approve / reject correction                       | 200          |
| GET         | /students/me/attendance          | Student        | My dashboard summary                              | 200          |
| POST        | /leave-requests                  | Student        | Submit leave request (multipart)                  | 201          |
| GET / PATCH | /leave-requests\[/{id}\]         | Faculty        | List pending / decide                             | 200          |
| GET         | /reports?type=&from=&to=&format= | Faculty, Admin | Generate / export report                          | 200 / 202    |
| GET         | /audit-logs                      | Admin          | Search audit log (read-only)                      | 200          |
| GET / PUT   | /policies                        | Admin          | Read / update policies                            | 200          |

### Examples

#### Submit Attendance

> PUT /api/v1/sessions/7f3c.../attendance
>
> Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
>
> Content-Type: application/json
>
> {
>
> "version": 3,
>
> "records": \[
>
> { "studentId": "PES1UG24CS101", "status": "PRESENT" },
>
> { "studentId": "PES1UG24CS102", "status": "ABSENT" },
>
> { "studentId": "PES1UG24CS103", "status": "LATE" }
>
> \]
>
> }
>
> 200 OK
>
> { "sessionId": "7f3c...", "saved": 3, "status": "MARKED", "version": 4 }

#### QR Check-in

> POST /api/v1/checkins
>
> { "token": "c2Vzc2lvbj03ZjNj...Zk.9aF2x...", "deviceId": "b1e2..." }
>
> 201 Created
>
> { "sessionId": "7f3c...", "status": "PRESENT", "checkedInAt": "2026-09-28T04:32:10Z" }

### Validation Rules (selected)

| **Field**               | **Rule**                                                                             |
|-------------------------|--------------------------------------------------------------------------------------|
| email                   | RFC 5322 format; must end with the institution's domain                              |
| password                | 10–128 characters; not in breached list                                              |
| status                  | One of PRESENT, ABSENT, LATE (EXCUSED is set only by the Leave Service)              |
| records\[\]             | 1–300 items; each studentId must be enrolled in the session's section; no duplicates |
| qr.durationMinutes      | Integer 1–10                                                                         |
| leave.fromDate / toDate | ISO date; fromDate ≤ toDate; fromDate ≥ today − 30 days                              |
| attachment              | application/pdf, image/jpeg or image/png by content; ≤ 5 MB                          |