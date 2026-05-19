# Timetable API — Backend Reference

All endpoints are prefixed with `/api`. UUIDs are used for all entity IDs. `armId` is always optional — when omitted or `null`, the record applies to the whole class (no arm). A class with arms and the same class without an arm are treated as distinct timetable scopes.

---

## Data Types

### PeriodConfig
```json
{
  "id": "string",           // e.g. "p_452uxyq3zvb"
  "periodNumber": "number",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "label": "string | null"  // e.g. "Break", "Assembly"
}
```

### ScheduleEntry
```json
{
  "id": "string",            // frontend-generated temp ID (e.g. "ub9rf3m4c7y")
  "classId": "string",
  "className": "string",
  "armId": "string | null",
  "armName": "string | null",
  "dayOfWeek": "Monday | Tuesday | Wednesday | Thursday | Friday",
  "periodId": "string",
  "periodNumber": "number",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "subjectId": "string",
  "subjectName": "string",
  "teacherId": "string",
  "teacherName": "string",
  "roomId": "string | null",
  "roomName": "string | null"
}
```

---

## Composite Key Rule

All timetable records (draft and published) are uniquely identified by:

```
(classId, termId, armId)
```

- `armId = null` and `armId = "some-uuid"` are **separate, independent records**
- Different arms of the same class each have their own draft and published timetable
- These are never merged or combined

---

## Endpoints

---

### 1. Get Timetable Draft

**`GET /api/admin/timetable/draft`**

Fetches the saved draft for a given class/term/arm combination. Returns `null` if no draft exists yet.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `classId` | string (UUID) | ✅ | Target class |
| `termId` | string (UUID) | ✅ | Target term |
| `armId` | string (UUID) | ❌ | Omit if class has no arms |

**Example Request**
```
GET /api/admin/timetable/draft?classId=97fdee7a-428f-42d4-b503-51ed3260c08e&termId=e4df07a0-ebb3-401b-8f09-4d78f0717d2b&armId=4c9b5405-0422-40c1-b4a2-3bf484581153
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "draft": {
      "id": "string | null",
      "classId": "string",
      "termId": "string",
      "armId": "string | null",
      "periods": [ "PeriodConfig" ],
      "schedules": [ "ScheduleEntry" ],
      "updatedAt": "ISO8601"
    }
  }
}
```

> Return `"draft": null` when no draft exists for the composite key. Do not return an error.

---

### 2. Save Timetable Draft

**`POST /api/admin/timetable/draft`**

Creates or updates (upserts) a draft timetable. Triggered automatically as the admin builds the timetable — treat this as an autosave endpoint.

**Request Body**

```json
{
  "classId": "string",
  "termId": "string",
  "academicYearId": "string",
  "armId": "string | null",
  "periods": [ "PeriodConfig" ],
  "schedules": [ "ScheduleEntry" ]
}
```

**Example Request**
```json
{
  "classId": "97fdee7a-428f-42d4-b503-51ed3260c08e",
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
  "armId": "4c9b5405-0422-40c1-b4a2-3bf484581153",
  "periods": [],
  "schedules": []
}
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "draftId": "string",
    "savedAt": "ISO8601"
  }
}
```

> Upsert on composite key `(classId, termId, armId)`. If a draft already exists for that key, overwrite it entirely with the new payload.

---

### 3. Delete Timetable Draft

**`DELETE /api/admin/timetable/draft`**

Deletes the draft matching the composite key. Called when an admin discards their draft.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `classId` | string (UUID) | ✅ | Target class |
| `termId` | string (UUID) | ✅ | Target term |
| `armId` | string (UUID) | ❌ | Omit if class has no arms |

**Example Request**
```
DELETE /api/admin/timetable/draft?classId=97fdee7a-...&termId=e4df07a0-...&armId=4c9b5405-...
```

**Success Response `200`**
```json
{
  "success": true
}
```

> Return `success: true` even if no draft existed for the key (idempotent delete).

---

### 4. Check Conflicts

**`POST /api/admin/timetable/check-conflicts`**

Validates a schedule for conflicts. The frontend only holds one draft at a time, so the backend **must** cross-check against all other arms of the same class and all other classes to catch teacher/room double-bookings the frontend cannot detect.

**Request Body**

```json
{
  "classId": "string",
  "termId": "string",
  "armId": "string | null",
  "schedules": [ "ScheduleEntry" ]
}
```

**Example Request**
```json
{
  "classId": "97fdee7a-428f-42d4-b503-51ed3260c08e",
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "armId": "4c9b5405-0422-40c1-b4a2-3bf484581153",
  "schedules": [
    {
      "id": "ub9rf3m4c7y",
      "classId": "97fdee7a-428f-42d4-b503-51ed3260c08e",
      "className": "SS 3",
      "armId": "4c9b5405-0422-40c1-b4a2-3bf484581153",
      "armName": "B",
      "dayOfWeek": "Monday",
      "periodId": "p_452uxyq3zvb",
      "periodNumber": 1,
      "startTime": "08:00",
      "endTime": "08:45",
      "subjectId": "eddf4496-8d3e-4066-893c-aaccfa9c970c",
      "subjectName": "Agricultural Science",
      "teacherId": "fa616111-ed64-4b51-8e1c-ae6854fc6e0f",
      "teacherName": "Kenechukwu Ajufo"
    }
  ]
}
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "hasConflicts": false,
    "conflicts": [
      {
        "type": "TEACHER_DOUBLE_BOOKING | ROOM_CONFLICT | PERIOD_DUPLICATION | SUBJECT_OVERLOAD",
        "severity": "error | warning",
        "message": "string",
        "slots": [
          { "day": "string", "periodId": "string" }
        ]
      }
    ]
  }
}
```

**Conflict Types**

| Type | Severity | Description |
|---|---|---|
| `TEACHER_DOUBLE_BOOKING` | `error` | Same teacher assigned to two classes at the same day/period |
| `ROOM_CONFLICT` | `error` | Same room assigned to two classes at the same day/period |
| `PERIOD_DUPLICATION` | `error` | Same subject/teacher assigned twice in the same period within this draft |
| `SUBJECT_OVERLOAD` | `warning` | A subject appears more times per week than a reasonable threshold |

> When `hasConflicts` is `false`, return `"conflicts": []`. Cross-check against **published** timetables of other arms and other classes — not just this draft.

---

### 5. Publish Timetable

**`POST /api/admin/timetable/publish`**

Publishes a finalized timetable. The backend should run a final conflict check before persisting. On success, the draft for this composite key should be deleted or marked as published.

**Request Body**

```json
{
  "academicYearId": "string",
  "termId": "string",
  "classId": "string",
  "armId": "string | null",
  "periods": [ "PeriodConfig" ],
  "schedules": [ "ScheduleEntry" ]
}
```

**Example Request**
```json
{
  "academicYearId": "74718fda-6ada-48cf-a52f-c4dc9cf05743",
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "classId": "97fdee7a-428f-42d4-b503-51ed3260c08e",
  "armId": "4c9b5405-0422-40c1-b4a2-3bf484581153",
  "schedules": [
    {
      "id": "ub9rf3m4c7y",
      "classId": "97fdee7a-428f-42d4-b503-51ed3260c08e",
      "className": "SS 3",
      "armId": "4c9b5405-0422-40c1-b4a2-3bf484581153",
      "armName": "B",
      "dayOfWeek": "Monday",
      "periodId": "p_452uxyq3zvb",
      "periodNumber": 1,
      "startTime": "08:00",
      "endTime": "08:45",
      "subjectId": "eddf4496-8d3e-4066-893c-aaccfa9c970c",
      "subjectName": "Agricultural Science",
      "teacherId": "fa616111-ed64-4b51-8e1c-ae6854fc6e0f",
      "teacherName": "Kenechukwu Ajufo"
    }
  ]
}
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "published": true,
    "publishedAt": "ISO8601",
    "timetableId": "string",
    "conflictsResolved": true,
    "schedules": [
      {
        "scheduleId": "string",
        "...": "all ScheduleEntry fields"
      }
    ]
  }
}
```

> The `schedules` array in the response must include backend-generated stable `scheduleId` values for each entry. These IDs are used downstream by the attendance system. The frontend `id` field on each schedule entry is a temporary client-side ID and should not be persisted as the canonical ID.

---

### 6. Get Published Timetable

**`GET /api/admin/timetable/published`**

Fetches the currently published timetable for a class/term/arm. Returns `null` if nothing has been published yet.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `classId` | string (UUID) | ✅ | Target class |
| `termId` | string (UUID) | ✅ | Target term |
| `armId` | string (UUID) | ❌ | Omit if class has no arms |

**Example Request**
```
GET /api/admin/timetable/published?classId=97fdee7a-...&termId=e4df07a0-...&armId=4c9b5405-...
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "timetable": {
      "id": "string",
      "classId": "string",
      "termId": "string",
      "armId": "string | null",
      "publishedAt": "ISO8601",
      "periods": [ "PeriodConfig" ],
      "schedules": [ "ScheduleEntry" ]
    }
  }
}
```

> Return `"timetable": null` when nothing is published. Do not return an error.

---

### 7. Get Teacher Daily Schedule

**`GET /api/teacher/timetable/today`**

Returns the authenticated teacher's scheduled classes for a given date. This endpoint directly powers the attendance system — the response shape must exactly match what `getScheduledClasses()` in `attendanceAPIs.js` expects.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | string (`YYYY-MM-DD`) | ✅ | Defaults to today if omitted |

**Example Request**
```
GET /api/teacher/timetable/today?date=2025-01-27
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "date": "YYYY-MM-DD",
    "academicContext": {
      "academicYearId": "string",
      "academicYear": "string",
      "termId": "string",
      "term": "string"
    },
    "scheduledClasses": [
      {
        "scheduleId": "string",
        "classId": "string",
        "className": "string",
        "subjectId": "string",
        "subjectName": "string",
        "periodId": "string",
        "periodNumber": "number",
        "timeSlot": {
          "start": "HH:mm",
          "end": "HH:mm"
        },
        "room": "string | null",
        "teacherId": "string",
        "attendanceStatus": "not_started | in_progress | completed",
        "attendanceId": "string | null",
        "studentCount": "number",
        "presentCount": "number",
        "absentCount": "number",
        "lateCount": "number"
      }
    ]
  }
}
```

> The `scheduleId` here must be the same stable backend-generated ID returned from the publish endpoint. The `attendanceStatus` and counts should reflect real-time state — query the attendance records for that date to compute them. Return an empty `scheduledClasses` array if the teacher has no classes on the given date or if the date falls outside an active term.

---

## Error Responses

All endpoints should return errors in this shape:

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

| HTTP Status | When to use |
|---|---|
| `400` | Missing required fields, invalid date format, malformed UUID |
| `401` | Unauthenticated request |
| `403` | Authenticated but insufficient role/permissions |
| `404` | Referenced entity (class, term, arm) does not exist |
| `409` | Conflict detected on publish (if backend blocks publishing with errors) |
| `500` | Unexpected server error |

---

## Notes for Implementation

- All timestamps must be returned as ISO 8601 strings (e.g. `2025-01-27T08:00:00.000Z`)
- Teacher identity for `/api/teacher/timetable/today` should be resolved from the auth token — do not accept `teacherId` as a query param
- The `armId = null` case must be handled explicitly in DB queries — do not use `IS NULL` interchangeably with missing param without intentional handling
- Draft saves are high-frequency (autosave) — keep the save endpoint lightweight; avoid heavy validation here, that belongs in check-conflicts
- Conflict checking should query **published** timetables across all classes and arms for the same term, not just the current draft
