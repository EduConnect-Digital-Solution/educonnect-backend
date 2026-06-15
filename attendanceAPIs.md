# Teacher Attendance Module — Backend API Contract

> **Purpose**: This document defines every HTTP endpoint that the teacher-dashboard attendance feature expects from the backend.
> All requests are authenticated via a Bearer token (JWT) sent in the `Authorization` header.
> The base URL is configured via the frontend environment — currently `https://educonnect-backend-staging.onrender.com`.

---

## Authentication

All attendance endpoints require an authenticated teacher session.

| Header | Value |
|---|---|
| `Authorization` | `Bearer <accessToken>` |
| `Content-Type` | `application/json` |

If the token is expired the frontend automatically retries with a refreshed token. A `401` response on any protected endpoint will trigger a logout redirect.

---

## Data Types

| Type | Format |
|---|---|
| Date | `YYYY-MM-DD` string |
| DateTime | ISO 8601 string (e.g. `2026-06-13T08:45:00.000Z`) |
| `attendanceStatus` | `"not_started"` · `"in_progress"` · `"completed"` |
| `studentStatus` | `"present"` · `"absent"` · `"late"` · `null` |

---

## Endpoints

### 1. Get Teacher's Daily Schedule

Retrieves the teacher's scheduled classes for a given date, including the attendance status for each session (not started / in-progress / completed).

```
GET /api/teacher/attendance/schedule
```

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | ✅ | The date to fetch the schedule for. Defaults to today. |
| `armId` | `string` (UUID) | — | Optional. Filter schedule to a specific arm. |

#### Example Request

```http
GET /api/teacher/attendance/schedule?date=2026-06-13
Authorization: Bearer <token>
```

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "date": "2026-06-13",
    "academicContext": {
      "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
      "academicYear": "2025/2026",
      "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
      "term": "First Term"
    },
    "scheduledClasses": [
      {
        "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
        "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
        "className": "SSS2",
        "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
        "armName": "A",
        "subjectId": "ab3dc3c3-a654-40cf-8244-91b51962c04f",
        "subjectName": "Mathematics",
        "periodId": "per_001",
        "periodNumber": 1,
        "timeSlot": {
          "start": "08:00",
          "end": "08:45"
        },
        "room": "Room 12A",
        "attendanceStatus": "completed",
        "attendanceId": "att_7f3a1b2c",
        "studentCount": 30,
        "presentCount": 25,
        "absentCount": 3,
        "lateCount": 2
      },
      {
        "scheduleId": "sch_cls_sss1_sub_english_p2",
        "classId": "f9c82d1a-b441-42e1-9a31-cd7b4e112233",
        "className": "SSS1",
        "armId": "c6f83b2d-4e5a-6b7c-8d9e-0f1a2b3c4d5e",
        "armName": "B",
        "subjectId": "bc4ed4d4-b765-51dg-9355-92c62073d15g",
        "subjectName": "English",
        "periodId": "per_002",
        "periodNumber": 2,
        "timeSlot": {
          "start": "09:00",
          "end": "09:45"
        },
        "room": null,
        "attendanceStatus": "not_started",
        "attendanceId": null,
        "studentCount": 28,
        "presentCount": 0,
        "absentCount": 0,
        "lateCount": 0
      }
    ]
  }
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `401` | Token invalid or expired |
| `403` | User is not a teacher |
| `500` | Server error |

---

### 2. Get Session Students

Returns the student roster for a specific scheduled session. If an attendance record already exists for this session (draft or submitted), each student's saved status should be included.

```
GET /api/teacher/attendance/sessions/:scheduleId/students
```

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `scheduleId` | `string` | The schedule identifier from the daily schedule |

#### Query Parameters (optional helpers)

| Param | Type | Description |
|---|---|---|
| `className` | `string` | Class name — helps backend resolve the student list |
| `subjectName` | `string` | Subject name — helps backend resolve the student list |
| `armId` | `string` (UUID) | Arm UUID — helps backend narrow the student list to a specific arm |

#### Example Request

```http
GET /api/teacher/attendance/sessions/sch_cls_sss2_sub_mathematics_p1/students?className=SSS2&subjectName=Mathematics
Authorization: Bearer <token>
```

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
    "attendanceId": null,
    "attendanceStatus": "not_started",
    "submittedAt": null,
    "students": [
      {
        "studentId": "453bb662-8842-445c-81ba-8980874a149b",
        "rollNumber": "SSS2/001",
        "fullName": "Prisilla Daniels",
        "status": null,
        "reason": "",
        "lateArrivalTime": ""
      },
      {
        "studentId": "7a1b3c4d-e5f6-7890-a1b2-c3d4e5f67890",
        "rollNumber": "SSS2/002",
        "fullName": "John Adeyemi",
        "status": "present",
        "reason": "",
        "lateArrivalTime": ""
      }
    ]
  }
}
```

> **Note**: If an attendance draft already exists for this session, return the saved statuses. If the session was already submitted (`attendanceStatus: "completed"`), return full student statuses so the UI can display the locked register.

#### Error Responses

| Status | Condition |
|---|---|
| `401` | Token invalid or expired |
| `404` | Schedule not found or teacher not assigned to it |
| `500` | Server error |

---

### 3. Save Draft Attendance

Saves an in-progress attendance register as a draft. Drafts are NOT visible to admins or parents. Calling this endpoint multiple times with the same `scheduleId` and `date` should **upsert** (update if a draft exists, create if not).

```
POST /api/teacher/attendance/draft
```

#### Request Body

```json
{
  "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
  "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
  "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
  "subjectId": "ab3dc3c3-a654-40cf-8244-91b51962c04f",
  "periodId": "per_001",
  "teacherId": "teacher-uuid-here",
  "date": "2026-06-13",
  "attendanceId": null,
  "attendances": [
    {
      "studentId": "453bb662-8842-445c-81ba-8980874a149b",
      "status": "present",
      "reason": "",
      "lateArrivalTime": ""
    },
    {
      "studentId": "7a1b3c4d-e5f6-7890-a1b2-c3d4e5f67890",
      "status": "absent",
      "reason": "Sick leave",
      "lateArrivalTime": ""
    },
    {
      "studentId": "8b2c4d5e-f6a7-8901-b2c3-d4e5f6789012",
      "status": null,
      "reason": "",
      "lateArrivalTime": ""
    }
  ]
}
```

> **Field notes**:
> - `attendanceId`: Pass `null` when creating. Pass the existing ID when updating a draft.
> - `status`: Can be `"present"`, `"absent"`, `"late"`, or `null` (not yet marked). Backend should store `null` statuses in draft records.
> - `lateArrivalTime`: `HH:mm` format or empty string.

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "attendanceId": "att_draft_1718277600000",
    "status": "draft",
    "savedAt": "2026-06-13T08:30:00.000Z"
  }
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Missing required fields or invalid payload |
| `401` | Token invalid or expired |
| `403` | Teacher not assigned to this class/subject |
| `409` | A submitted (locked) record already exists for this session |
| `500` | Server error |

---

### 4. Submit Attendance

Finalises and locks an attendance record. Once submitted, the record is visible to admins and parents. A submitted record **cannot** be deleted, only edited via the `PUT` endpoint.

```
POST /api/teacher/attendance/submit
```

#### Request Body

Same shape as `POST /api/teacher/attendance/draft`.

```json
{
  "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
  "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
  "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
  "subjectId": "ab3dc3c3-a654-40cf-8244-91b51962c04f",
  "periodId": "per_001",
  "teacherId": "teacher-uuid-here",
  "date": "2026-06-13",
  "attendanceId": "att_draft_1718277600000",
  "attendances": [
    {
      "studentId": "453bb662-8842-445c-81ba-8980874a149b",
      "status": "present",
      "reason": "",
      "lateArrivalTime": ""
    },
    {
      "studentId": "7a1b3c4d-e5f6-7890-a1b2-c3d4e5f67890",
      "status": "absent",
      "reason": "Sick leave",
      "lateArrivalTime": ""
    },
    {
      "studentId": "8b2c4d5e-f6a7-8901-b2c3-d4e5f6789012",
      "status": "late",
      "reason": "Bus delay",
      "lateArrivalTime": "08:20"
    }
  ]
}
```

> **Business rule**: Students whose `status` is `null` in the payload should be **excluded** from the submitted record (the frontend already warns the teacher before submission). The backend should treat a `null` status as "not recorded" and not store it as a submitted attendance entry.

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "attendanceId": "att_7f3a1b2c",
    "status": "submitted",
    "submittedAt": "2026-06-13T08:45:00.000Z",
    "summary": {
      "total": 30,
      "present": 25,
      "absent": 3,
      "late": 2
    }
  }
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Missing required fields, or all students have `null` status |
| `401` | Token invalid or expired |
| `403` | Teacher not assigned to this class/subject |
| `409` | A submitted record already exists for this exact session and date |
| `500` | Server error |

---

### 5. Update / Edit Submitted Attendance

Edits a previously submitted attendance record. The backend **must** log an audit trail entry recording who made the change, what changed, and when. The record remains in `"submitted"` status after an update.

```
PUT /api/teacher/attendance/:attendanceId
```

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `attendanceId` | `string` | The attendance record ID to update |

#### Request Body

```json
{
  "editReason": "Correcting an entry marked incorrectly during the session",
  "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
  "attendances": [
    {
      "studentId": "453bb662-8842-445c-81ba-8980874a149b",
      "status": "absent",
      "reason": "Medical appointment",
      "lateArrivalTime": ""
    },
    {
      "studentId": "7a1b3c4d-e5f6-7890-a1b2-c3d4e5f67890",
      "status": "present",
      "reason": "",
      "lateArrivalTime": ""
    }
  ]
}
```

> **Field notes**:
> - `editReason`: Optional string. Stored in the audit log.
> - Only include students whose records you want to change, **OR** send the full list — both approaches should be supported. Sending the full list is safer.

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "attendanceId": "att_7f3a1b2c",
    "status": "submitted",
    "updatedAt": "2026-06-13T10:15:00.000Z",
    "summary": {
      "total": 30,
      "present": 24,
      "absent": 4,
      "late": 2
    }
  }
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Invalid payload |
| `401` | Token invalid or expired |
| `403` | Teacher not owner of this record, or admin-locked |
| `404` | `attendanceId` not found |
| `500` | Server error |

---

### 6. Get Attendance History

Returns a paginated list of submitted (and optionally draft) attendance records for the authenticated teacher. Used for reviewing past sessions.

```
GET /api/teacher/attendance/history
```

#### Query Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `20` | Records per page |
| `classId` | `string` | — | Filter by class UUID |
| `armId` | `string` (UUID) | — | Filter by arm UUID |
| `subjectId` | `string` | — | Filter by subject UUID |
| `startDate` | `YYYY-MM-DD` | — | Inclusive start of date range |
| `endDate` | `YYYY-MM-DD` | — | Inclusive end of date range |
| `status` | `string` | `"submitted"` | `"submitted"` · `"draft"` · `"all"` |

#### Example Request

```http
GET /api/teacher/attendance/history?page=1&limit=20&status=submitted&startDate=2026-06-01&endDate=2026-06-30
Authorization: Bearer <token>
```

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "records": [
      {
        "attendanceId": "att_7f3a1b2c",
        "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
        "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
        "className": "SSS2",
        "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
        "armName": "A",
        "subjectId": "ab3dc3c3-a654-40cf-8244-91b51962c04f",
        "subjectName": "Mathematics",
        "date": "2026-06-13",
        "periodNumber": 1,
        "status": "submitted",
        "submittedAt": "2026-06-13T08:45:00.000Z",
        "summary": {
          "total": 30,
          "present": 25,
          "absent": 3,
          "late": 2
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 7. Get Attendance Records by Date

Returns all attendance sessions (submitted + drafts) for a specific date. Behaves like endpoint **#1** but returns the actual submission status of each session instead of constructing them fresh.

```
GET /api/teacher/attendance/date/:date
```

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `date` | `YYYY-MM-DD` | The date to query |

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `armId` | `string` (UUID) | — | Optional. Filter to a specific arm. |

#### Example Request

```http
GET /api/teacher/attendance/date/2026-06-12
Authorization: Bearer <token>
```

#### Expected Response `200 OK`

Same structure as **Endpoint #1** (`GET /api/teacher/attendance/schedule`):

```json
{
  "success": true,
  "data": {
    "date": "2026-06-12",
    "academicContext": {
      "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
      "academicYear": "2025/2026",
      "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
      "term": "First Term"
    },
    "scheduledClasses": [
      {
        "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
        "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
        "className": "SSS2",
        "armId": "b5e72a1c-3d4f-5a6b-7c8d-9e0f1a2b3c4d",
        "armName": "A",
        "subjectId": "ab3dc3c3-a654-40cf-8244-91b51962c04f",
        "subjectName": "Mathematics",
        "periodId": "per_001",
        "periodNumber": 1,
        "timeSlot": { "start": "08:00", "end": "08:45" },
        "room": "Room 12A",
        "attendanceStatus": "completed",
        "attendanceId": "att_7f3a1b2c",
        "studentCount": 30,
        "presentCount": 25,
        "absentCount": 3,
        "lateCount": 2
      }
    ]
  }
}
```

---

### 8. Get Attendance Summary for a Session

Returns the summary statistics for a specific past attendance session. Used to update class board cards (present/absent/late counts) after submission without re-fetching the full student list.

```
GET /api/teacher/attendance/summary/:scheduleId
```

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `scheduleId` | `string` | The schedule identifier |

#### Example Request

```http
GET /api/teacher/attendance/summary/sch_cls_sss2_sub_mathematics_p1
Authorization: Bearer <token>
```

#### Expected Response `200 OK`

```json
{
  "success": true,
  "data": {
    "scheduleId": "sch_cls_sss2_sub_mathematics_p1",
    "attendanceId": "att_7f3a1b2c",
    "attendanceStatus": "completed",
    "submittedAt": "2026-06-13T08:45:00.000Z",
    "summary": {
      "total": 30,
      "present": 25,
      "absent": 3,
      "late": 2
    }
  }
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `404` | No attendance record found for this `scheduleId` |
| `401` | Unauthorized |

---

## Standard Error Response Shape

All errors should follow this envelope:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

---

## Routing Summary

| # | Method | Path | Description |
|---|---|---|---|
| 1 | `GET` | `/api/teacher/attendance/schedule` | Get teacher's daily schedule with attendance status |
| 2 | `GET` | `/api/teacher/attendance/sessions/:scheduleId/students` | Get student roster + saved statuses for a session |
| 3 | `POST` | `/api/teacher/attendance/draft` | Save in-progress attendance as a draft |
| 4 | `POST` | `/api/teacher/attendance/submit` | Finalise & lock attendance |
| 5 | `PUT` | `/api/teacher/attendance/:attendanceId` | Edit a submitted record (with audit trail) |
| 6 | `GET` | `/api/teacher/attendance/history` | Paginated history of teacher's attendance records |
| 7 | `GET` | `/api/teacher/attendance/date/:date` | Get all sessions + statuses for a past date |
| 8 | `GET` | `/api/teacher/attendance/summary/:scheduleId` | Lightweight summary stats for one session |

---

## Frontend Integration Notes

- **`ATTENDANCE_BACKEND_LIVE`** flag in `attendanceAPIs.js` must be set to `true` once all 8 routes are live. While `false`, read routes fall back to assembling data from existing teacher endpoints, and write routes use local mocks.
- The frontend sends `attendanceId: null` on first submit. The backend assigns a UUID and returns it. All subsequent calls (draft updates, final edits) pass the returned `attendanceId`.
- The `academicYearId` and `termId` fields in write payloads come from the teacher dashboard context (`GET /api/teacher/dashboard`). The backend should validate these match the active academic period.
- `armId` should be included alongside `classId` wherever a class is identified — in query filters, write payloads, and response objects — to support schools that split classes into arms (e.g. SSS2A, SSS2B).
- `scheduleId` values generated by the fallback mode follow the pattern `sch_<classSlug>_<subjectSlug>_p<periodNumber>`. When the real timetable endpoint is live, `scheduleId` will be a UUID from the timetable database — the frontend will use whatever `scheduleId` the schedule endpoint returns.
