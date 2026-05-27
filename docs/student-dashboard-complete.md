# EduConnect — Student Dashboard: Complete API Reference

> **Base URL:** `/api/v1`
> **Auth:** All endpoints (except where noted) require `Authorization: Bearer <jwt>`
> **Role guard:** `role === "student"` enforced server-side on every route
> **Stack:** Node/Express · Supabase (Postgres) · Zod validation
> **Content-Type default:** `application/json` unless stated otherwise

---

## Quick Reference — All Endpoints

| Method | Endpoint | Screen | Status |
|---|---|---|---|
| `GET` | `/student/me` | Global / Sidebar | ✅ To build |
| `GET` | `/student/notifications` | Global / Header bell | ✅ To build |
| `PATCH` | `/student/notifications/:id/read` | Global / Header bell | ✅ To build |
| `PATCH` | `/student/notifications/read-all` | Global / Header bell | ✅ To build |
| `GET` | `/student/dashboard` | Screen 1 — Dashboard Home | ✅ To build |
| `GET` | `/student/timetable` | Screen 1 — Dashboard Home | ✅ To build |
| `GET` | `/student/terms` | Screen 2 — My Academics (term dropdown) | ✅ To build |
| `GET` | `/student/academics` | Screen 2 — My Academics | ✅ To build |
| `GET` | `/student/assignments` | Screen 3 — Assignments | ✅ To build |
| `GET` | `/student/assignments/:assignmentId` | Screen 3 — Assignments | ✅ To build |
| `POST` | `/student/assignments/:assignmentId/submit` | Screen 3 — Assignments | ✅ To build |
| `GET` | `/student/teachers` | Screen 4 — Teacher's Directory | ✅ To build |
| `GET` | `/student/profile` | Screen 5 — Student Profile | ✅ To build |
| `PATCH` | `/student/profile` | Screen 5 — Student Profile | ✅ To build |
| `GET` | `/student/activity` | Screen 5 — Student Profile (activity feed) | ✅ To build |
| `GET` | `/student/settings` | Screen 6 — Account & Settings | ✅ To build |
| `PATCH` | `/student/settings` | Screen 6 — Account & Settings | ✅ To build |
| `POST` | `/student/auth/change-password` | Screen 6 — Account & Settings | ✅ To build |
| `GET` | `/config/locales` | Screen 6 — Settings (language dropdown) | ✅ To build |

---

## Table of Contents

1. [Global / Layout Endpoints](#1-global--layout-endpoints)
   - 1.1 [Identity — `GET /student/me`](#11-identity)
   - 1.2 [Notifications — List](#12-notifications--list)
   - 1.3 [Notifications — Mark Read](#13-notifications--mark-read)
   - 1.4 [Notifications — Mark All Read](#14-notifications--mark-all-read)
2. [Screen 1 — Dashboard Home](#2-screen-1--dashboard-home)
   - 2.1 [Overview Cards — `GET /student/dashboard`](#21-overview-cards)
   - 2.2 [Timetable — `GET /student/timetable`](#22-timetable)
3. [Screen 2 — My Academics](#3-screen-2--my-academics)
   - 3.1 [Term List — `GET /student/terms`](#31-term-list)
   - 3.2 [Academics List — `GET /student/academics`](#32-academics-list)
4. [Screen 3 — Assignments & Submissions](#4-screen-3--assignments--submissions)
   - 4.1 [List Assignments — `GET /student/assignments`](#41-list-assignments)
   - 4.2 [Single Assignment — `GET /student/assignments/:id`](#42-single-assignment)
   - 4.3 [Submit Assignment — `POST /student/assignments/:id/submit`](#43-submit-assignment)
5. [Screen 4 — Teacher's Directory](#5-screen-4--teachers-directory)
   - 5.1 [Teacher List — `GET /student/teachers`](#51-teacher-list)
6. [Screen 5 — Student Profile](#6-screen-5--student-profile)
   - 6.1 [Fetch Profile — `GET /student/profile`](#61-fetch-profile)
   - 6.2 [Update Profile — `PATCH /student/profile`](#62-update-profile)
   - 6.3 [Activity Feed — `GET /student/activity`](#63-activity-feed)
7. [Screen 6 — Account Security & Settings](#7-screen-6--account-security--settings)
   - 7.1 [Fetch Settings — `GET /student/settings`](#71-fetch-settings)
   - 7.2 [Update Settings — `PATCH /student/settings`](#72-update-settings)
   - 7.3 [Change Password — `POST /student/auth/change-password`](#73-change-password)
   - 7.4 [Supported Locales — `GET /config/locales`](#74-supported-locales)
8. [Schema Discrepancies & Fixes](#8-schema-discrepancies--fixes)
9. [Error Reference](#9-error-reference)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Global / Layout Endpoints

These power the **sidebar**, **header**, and **notification bell** visible across all six dashboard screens. They should be fetched once on app mount and cached client-side for the session duration.

---

### 1.1 Identity

#### `GET /api/v1/student/me`

Lightweight identity endpoint. Powers the sidebar avatar, name, class label, and school logo. Call once on mount — do not re-fetch on every route change.

**Auth:** Required · **Role:** `student`

**Request**
```http
GET /api/v1/student/me
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "studentId": "uuid",
    "fullName": "Chidera Obi",
    "avatarUrl": "https://...",
    "class": "JSS 2A",
    "schoolName": "Greenfield Academy",
    "schoolLogoUrl": "https://..."
  }
}
```

---

### 1.2 Notifications — List

#### `GET /api/v1/student/notifications`

Returns the student's notifications for the bell dropdown. Default: most recent 20, unread first.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `unread` | `boolean` | No | `true` to return only unread notifications |
| `page` | `integer` | No | Default `1` |
| `limit` | `integer` | No | Default `20`, max `50` |

**Request**
```http
GET /api/v1/student/notifications?page=1&limit=20
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "unreadCount": 4,
    "notifications": [
      {
        "notificationId": "uuid",
        "type": "grade_published",
        "title": "Your Mathematics grade has been published",
        "body": "You scored 82% in the Mid-term assessment.",
        "isRead": false,
        "createdAt": "2025-07-09T12:00:00Z",
        "meta": {
          "subjectId": "uuid",
          "assessmentId": "uuid"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 14
    }
  }
}
```

**Notes**
- `type` values: `"grade_published" | "assignment_due" | "fee_reminder" | "announcement" | "submission_graded"`
- `meta` is a flexible object scoped to the notification type — always include the relevant resource ID so the frontend can deep-link
- `unreadCount` is always returned regardless of `unread` filter, so the bell badge stays accurate

---

### 1.3 Notifications — Mark Read

#### `PATCH /api/v1/student/notifications/:notificationId/read`

Marks a single notification as read.

**Auth:** Required · **Role:** `student`

**Path Params**

| Param | Type | Description |
|---|---|---|
| `notificationId` | `uuid` | Notification ID |

**Request**
```http
PATCH /api/v1/student/notifications/uuid/read
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "notificationId": "uuid",
    "isRead": true
  }
}
```

**Errors**
- `404` — Notification not found or belongs to another student

---

### 1.4 Notifications — Mark All Read

#### `PATCH /api/v1/student/notifications/read-all`

Marks all of the student's notifications as read in one call.

**Auth:** Required · **Role:** `student`

**Request**
```http
PATCH /api/v1/student/notifications/read-all
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "markedRead": 4
  }
}
```

> ⚠️ **Route order matters:** Register `read-all` before `/:notificationId/read` in Express, otherwise `read-all` will be caught as a param match.

---

## 2. Screen 1 — Dashboard Home

### What this screen shows
Four overview stat cards (Total Enrollments, Events, Performance %, Current Class) and a weekly timetable grid below.

---

### 2.1 Overview Cards

#### `GET /api/v1/student/dashboard`

Returns the overview cards and summary data rendered at the top of the dashboard.

**Auth:** Required · **Role:** `student`

**Request**
```http
GET /api/v1/student/dashboard
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "overview": {
      "totalEnrollments": 8,
      "totalEvents": 3,
      "performanceScore": 95,
      "attendanceRate": 88,
      "currentClass": "Primary 5"
    },
    "performanceCards": [
      {
        "subjectId": "uuid",
        "subjectName": "Mathematics",
        "gradePercent": 95,
        "trend": "up"
      }
    ],
    "upcomingEvents": [
      {
        "eventId": "uuid",
        "title": "Mid-term Examination",
        "date": "2025-07-14T09:00:00Z",
        "type": "exam"
      }
    ]
  }
}
```

**Notes**
- `performanceScore` — average of all current-term subject grades; computed server-side, never on the client
- `trend` — `"up" | "down" | "stable"` relative to last term's grade for that subject
- `currentClass` — the student's enrolled class name; powers the 4th overview card in the Figma
- `upcomingEvents` — limit to the next 5 events; full event list lives on the admin/calendar module
- Cache this response per student for 5 minutes (Cloudflare Workers KV or Supabase edge cache)

---

### 2.2 Timetable

#### `GET /api/v1/student/timetable`

Returns the student's weekly timetable grid shown at the bottom of the dashboard home screen.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `week` | `YYYY-Www` | No | ISO week string. Defaults to current week |
| `termId` | `uuid` | No | Filter by term. Defaults to active term |

**Request**
```http
GET /api/v1/student/timetable?week=2025-W28
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "termId": "uuid",
    "termName": "First Term 2024/2025",
    "week": "2025-W28",
    "schedule": [
      {
        "day": "Monday",
        "date": "2025-07-14",
        "slots": [
          {
            "slotId": "uuid",
            "startTime": "08:00",
            "endTime": "09:00",
            "subjectName": "Mathematics",
            "teacherName": "Mr. Adebayo",
            "classroom": "Room 12",
            "locationCode": "Block A",
            "type": "class"
          }
        ]
      }
    ]
  }
}
```

**Notes**
- `type` — `"class" | "break" | "assembly" | "exam"`
- `date` — ISO date string (`YYYY-MM-DD`) computed server-side from `week` param + day index; the Figma renders an actual calendar date per row, not just the day name
- `locationCode` — maps to the Figma's "Left Point" column (room/wing/zone code); return `null` if not configured
- Days with no slots still appear in the array with `"slots": []` — prevents client-side conditional rendering complexity
- Never expose other students' timetable data; filter strictly by `studentId` from JWT

---

## 3. Screen 2 — My Academics

### What this screen shows
A filterable table of subjects with grades, attendance, performance status, and assigned teacher. Has a term selector dropdown at the top right.

---

### 3.1 Term List

#### `GET /api/v1/student/terms`

Populates the term selector dropdown on the My Academics screen. Scoped to the student's school.

**Auth:** Required · **Role:** `student`

**Request**
```http
GET /api/v1/student/terms
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "terms": [
      {
        "termId": "uuid",
        "termName": "First Term 2024/2025",
        "isActive": true,
        "startDate": "2024-09-09",
        "endDate": "2024-12-20"
      },
      {
        "termId": "uuid",
        "termName": "Third Term 2023/2024",
        "isActive": false,
        "startDate": "2024-04-22",
        "endDate": "2024-07-19"
      }
    ]
  }
}
```

**Notes**
- Return in reverse chronological order; active term always first
- Scoped to `school_id` derived from JWT — never cross-school
- No pagination — a school will never have more than ~10–15 terms in the system

---

### 3.2 Academics List

#### `GET /api/v1/student/academics`

Returns the student's subject list with grades, attendance, performance status, and assigned teacher for a given term.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `termId` | `uuid` | No | Defaults to active term |
| `page` | `integer` | No | Default `1` |
| `limit` | `integer` | No | Default `20`, max `50` |

**Request**
```http
GET /api/v1/student/academics?termId=uuid&page=1&limit=20
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "termId": "uuid",
    "termName": "First Term 2024/2025",
    "subjects": [
      {
        "subjectId": "uuid",
        "subjectName": "English Language",
        "rawScore": 47,
        "maxScore": 60,
        "currentGradePercent": 78,
        "gradeLabel": "B",
        "attendanceType": "Full",
        "attendancePercent": 92,
        "performanceStatus": "On Track",
        "assignedTeacher": {
          "teacherId": "uuid",
          "fullName": "Mrs. Okonkwo",
          "avatarUrl": "https://..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8
    }
  }
}
```

**Notes**
- `performanceStatus` — `"Excellent" | "On Track" | "At Risk" | "Needs Improvement"` — computed server-side from grade + attendance combination; never delegate this logic to the frontend
- `gradeLabel` — follows the school's configured grading scale from `schools.grading_config`
- `attendanceType` — `"Full" | "Partial" | "Absent"` — derived from term-to-date attendance records
- `rawScore` + `maxScore` — included alongside `currentGradePercent` so the frontend can render either format; the Figma "Current Grade No." column suggests raw scores may be displayed rather than percentages
- Never expose full mark-sheet data here; use a dedicated result/report-card endpoint for that

---

## 4. Screen 3 — Assignments & Submissions

### What this screen shows
Pending assignment cards (top left), a countdown timer to the next due assignment (top right), a "Find Tutor" CTA (mid), and a peer crowdsourcing/discussion zone (bottom).

> **Note — Find Tutor:** The Figma CTA will redirect to an external tutor platform URL. This URL should be stored in school settings and returned in `GET /student/dashboard` as `"tutorPlatformUrl": "https://..."`. No dedicated tutor endpoint is needed at this stage.
>
> **Note — Peer Discussion / Crowdsourcing:** This is a post-MVP feature. The frontend should render this section as a placeholder or hide it behind a feature flag until the discussion endpoints are built.

---

### 4.1 List Assignments

#### `GET /api/v1/student/assignments`

Returns the student's assignments, filtered by status. Pending items should be fetched first for the dashboard view.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | No | `"pending" \| "submitted" \| "graded" \| "overdue"` — omit for all |
| `subjectId` | `uuid` | No | Filter by subject |
| `termId` | `uuid` | No | Defaults to active term |
| `page` | `integer` | No | Default `1` |
| `limit` | `integer` | No | Default `20`, max `50` |

**Request**
```http
GET /api/v1/student/assignments?status=pending&page=1&limit=10
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "assignments": [
      {
        "assignmentId": "uuid",
        "title": "Essay: Nigerian Independence",
        "subjectName": "Social Studies",
        "teacherName": "Mr. Bello",
        "dueAt": "2025-07-10T23:59:00Z",
        "status": "pending",
        "submittedAt": null,
        "gradePercent": null,
        "feedback": null,
        "attachments": [
          {
            "fileId": "uuid",
            "fileName": "assignment_brief.pdf",
            "fileUrl": "https://...",
            "mimeType": "application/pdf"
          }
        ]
      }
    ],
    "countdown": {
      "nextDueAssignmentId": "uuid",
      "nextDueAt": "2025-07-10T23:59:00Z",
      "secondsRemaining": 82345
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5
    }
  }
}
```

**Notes**
- `countdown` — always reflects the single nearest pending deadline for this student; returned on every call regardless of `status` filter so the timer is always present
- `nextDueAt` — ISO timestamp included alongside `secondsRemaining` so the frontend can recompute remaining time on tab focus/refresh without a refetch
- `countdown` returns `null` if no pending assignments exist

---

### 4.2 Single Assignment

#### `GET /api/v1/student/assignments/:assignmentId`

Returns a single assignment's full detail, including any existing submission.

**Auth:** Required · **Role:** `student`

**Path Params**

| Param | Type | Description |
|---|---|---|
| `assignmentId` | `uuid` | Assignment ID |

**Request**
```http
GET /api/v1/student/assignments/uuid
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "assignmentId": "uuid",
    "title": "Essay: Nigerian Independence",
    "description": "Write a 500-word essay on...",
    "subjectName": "Social Studies",
    "teacherName": "Mr. Bello",
    "dueAt": "2025-07-10T23:59:00Z",
    "maxScore": 100,
    "status": "pending",
    "submittedAt": null,
    "gradePercent": null,
    "feedback": null,
    "attachments": [],
    "submission": null
  }
}
```

**Errors**
- `404` — Assignment not found or does not belong to this student's enrolled class

---

### 4.3 Submit Assignment

#### `POST /api/v1/student/assignments/:assignmentId/submit`

Submits an assignment. Accepts a text response and/or file attachments.

**Auth:** Required · **Role:** `student`
**Content-Type:** `multipart/form-data`

**Path Params**

| Param | Type | Description |
|---|---|---|
| `assignmentId` | `uuid` | Assignment ID |

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `textResponse` | `string` | No | Plain text or markdown response body |
| `files` | `File[]` | No | Max 5 files, 10MB each |

**Validation**
- At least one of `textResponse` or `files` must be present
- Accepted MIME types: `application/pdf`, `image/jpeg`, `image/png`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Reject submissions after `dueAt` with `409` unless `school.settings.allow_late_submissions` is `true`

**Request**
```http
POST /api/v1/student/assignments/uuid/submit
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

textResponse: "My essay response..."
files: [essay.pdf]
```

**Response `201`**
```json
{
  "data": {
    "submissionId": "uuid",
    "assignmentId": "uuid",
    "submittedAt": "2025-07-09T14:32:00Z",
    "status": "submitted",
    "files": [
      {
        "fileId": "uuid",
        "fileName": "essay.pdf",
        "fileUrl": "https://...",
        "mimeType": "application/pdf"
      }
    ]
  }
}
```

**Errors**

| Code | HTTP | Trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | No content, invalid file type, or file too large |
| `ALREADY_SUBMITTED` | 409 | Assignment already has a submission |
| `DEADLINE_PASSED` | 409 | Past `dueAt` and late submissions are off |
| `NOT_FOUND` | 422 | Assignment does not belong to student's class |

---

## 5. Screen 4 — Teacher's Directory

### What this screen shows
A grid of teacher cards: avatar, name, subject tags, email, phone, and a "Message" button. The Message button redirects to the teacher's school email (`mailto:`) — no in-app messaging at this stage.

---

### 5.1 Teacher List

#### `GET /api/v1/student/teachers`

Returns the directory of teachers linked to the student's school.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `search` | `string` | No | Search by name or subject |
| `subjectId` | `uuid` | No | Filter by subject |
| `page` | `integer` | No | Default `1` |
| `limit` | `integer` | No | Default `20`, max `50` |

**Request**
```http
GET /api/v1/student/teachers?search=okonkwo&page=1&limit=20
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "teachers": [
      {
        "teacherId": "uuid",
        "fullName": "Mrs. Adaeze Okonkwo",
        "subjects": ["English Language", "Literature"],
        "avatarUrl": "https://...",
        "contact": {
          "email": "a.okonkwo@school.edu.ng",
          "phone": "+234 801 234 5678"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12
    }
  }
}
```

**Notes**
- Only return teachers linked to the student's school — never expose cross-school records
- `contact.phone` — only expose if `school.settings.show_teacher_phone === true`; omit the field entirely (not `null`) if suppressed
- `contact.email` — always the school-issued address; never a personal address
- The "Message" button on the Figma card should open `mailto:{contact.email}` — no backend call needed

---

## 6. Screen 5 — Student Profile

### What this screen shows
A full profile card (personal details, contact, guardian info), and a recent activity feed below. A pencil edit button is visible — only phone, address, and avatar are student-editable; all other fields are read-only and require admin changes.

---

### 6.1 Fetch Profile

#### `GET /api/v1/student/profile`

Returns the authenticated student's full profile.

**Auth:** Required · **Role:** `student`

**Request**
```http
GET /api/v1/student/profile
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "studentId": "uuid",
    "admissionNumber": "ECN/2024/0042",
    "fullName": "Chidera Obi",
    "avatarUrl": "https://...",
    "personal": {
      "dateOfBirth": "2010-04-15",
      "gender": "Male",
      "bloodGroup": "O+",
      "stateOfOrigin": "Anambra",
      "nationality": "Nigerian",
      "address": "12 Palm Avenue, Ikeja, Lagos"
    },
    "contact": {
      "email": "chidera.obi@school.edu.ng",
      "phone": "+234 802 345 6789"
    },
    "guardian": {
      "fullName": "Mr. Emeka Obi",
      "relationship": "Father",
      "phone": "+234 803 456 7890",
      "email": "emeka.obi@gmail.com",
      "address": "12 Palm Avenue, Ikeja, Lagos"
    },
    "academic": {
      "class": "JSS 2A",
      "termId": "uuid",
      "termName": "First Term 2024/2025",
      "enrolledAt": "2022-09-05"
    },
    "recentActivity": [
      {
        "activityId": "uuid",
        "type": "submission",
        "description": "Submitted 'Essay: Nigerian Independence'",
        "timestamp": "2025-07-09T14:32:00Z"
      }
    ]
  }
}
```

**Notes**
- `recentActivity` — return the latest 5 items inline here; the full paginated feed is available via `GET /student/activity`
- Guardian and academic fields are read-only for students; changes go through admin

---

### 6.2 Update Profile

#### `PATCH /api/v1/student/profile`

Updates the student's editable profile fields. Only `phone`, `address`, and `avatar` are permitted — all other fields are ignored server-side.

**Auth:** Required · **Role:** `student`
**Content-Type:** `multipart/form-data`

**Body (all optional)**

| Field | Type | Description |
|---|---|---|
| `phone` | `string` | Student contact number |
| `address` | `string` | Residential address |
| `avatar` | `File` | Profile photo — max 2MB, JPEG/PNG/WEBP only |

**Validation**
- `phone` — Nigerian format: `/^\+234[0-9]{10}$/` or `0[789][01][0-9]{8}`
- Allowlist enforced server-side — any field not in the three above is stripped before processing (mass assignment protection)
- `avatar` — stream directly to Supabase Storage; do not buffer in Express memory

**Request**
```http
PATCH /api/v1/student/profile
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

phone: "+234 802 345 6789"
address: "14 Palm Avenue, Ikeja, Lagos"
avatar: [file]
```

**Response `200`**
```json
{
  "data": {
    "studentId": "uuid",
    "updatedFields": ["phone", "avatar"],
    "avatarUrl": "https://..."
  }
}
```

> **Frontend note:** The Figma's single edit button implies the full form is editable. Render non-editable fields (name, DOB, blood group, guardian details, class) as locked/read-only even in edit mode. Consider adding a small "Contact admin to change" tooltip on those fields.

---

### 6.3 Activity Feed

#### `GET /api/v1/student/activity`

Returns the student's full paginated activity feed. Use this when the profile screen has a "View All" or infinite-scroll behaviour beyond the 5 items embedded in the profile response.

**Auth:** Required · **Role:** `student`

**Query Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | No | Filter by activity type (see values below) |
| `page` | `integer` | No | Default `1` |
| `limit` | `integer` | No | Default `20`, max `50` |

**Request**
```http
GET /api/v1/student/activity?page=1&limit=20
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "activities": [
      {
        "activityId": "uuid",
        "type": "submission",
        "description": "Submitted 'Essay: Nigerian Independence'",
        "timestamp": "2025-07-09T14:32:00Z",
        "meta": {
          "assignmentId": "uuid"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47
    }
  }
}
```

**`type` values:** `"submission" | "grade_received" | "login" | "profile_update" | "fee_payment"`

**Notes**
- `meta` is a flexible object keyed by the resource relevant to the activity type; always include the relevant resource ID for deep-linking
- Return in reverse chronological order (newest first)

---

## 7. Screen 6 — Account Security & Settings

### What this screen shows
Two toggle panels (notification preferences + app preferences), a language dropdown, and a change password form.

---

### 7.1 Fetch Settings

#### `GET /api/v1/student/settings`

Returns the student's current notification and application preferences.

**Auth:** Required · **Role:** `student`

**Request**
```http
GET /api/v1/student/settings
Authorization: Bearer <jwt>
```

**Response `200`**
```json
{
  "data": {
    "notifications": {
      "assignmentReminders": true,
      "gradePublished": true,
      "feeReminders": true,
      "schoolAnnouncements": true,
      "smsEnabled": false,
      "emailEnabled": true
    },
    "preferences": {
      "language": "en",
      "timezone": "Africa/Lagos",
      "darkMode": false,
      "compactView": false
    }
  }
}
```

---

### 7.2 Update Settings

#### `PATCH /api/v1/student/settings`

Updates notification preferences and/or application preferences. Send only the fields that changed — partial updates are supported.

**Auth:** Required · **Role:** `student`
**Content-Type:** `application/json`

**Body (all optional)**
```json
{
  "notifications": {
    "smsEnabled": true,
    "gradePublished": false
  },
  "preferences": {
    "darkMode": true,
    "language": "yo"
  }
}
```

**Validation**
- All boolean fields must be strictly `true | false` — reject strings like `"true"` or `"1"`
- `language` must be in the server's supported locale list; see `GET /config/locales`
- `timezone` must be a valid IANA timezone string (e.g. `"Africa/Lagos"`)

**Request**
```http
PATCH /api/v1/student/settings
Authorization: Bearer <jwt>
Content-Type: application/json

{ "preferences": { "darkMode": true } }
```

**Response `200`**
```json
{
  "data": {
    "updatedFields": ["preferences.darkMode"]
  }
}
```

---

### 7.3 Change Password

#### `POST /api/v1/student/auth/change-password`

Changes the student's account password. Rate-limited to 5 attempts per 15 minutes per student.

**Auth:** Required · **Role:** `student`
**Content-Type:** `application/json`

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | `string` | Yes | The student's existing password |
| `newPassword` | `string` | Yes | Must meet complexity requirements |
| `confirmPassword` | `string` | Yes | Must exactly match `newPassword` |

**Validation**
- `newPassword` — min 8 chars, at least one uppercase letter, one number, one special character
- `confirmPassword` must match `newPassword` exactly
- `currentPassword` must be verified before any change is persisted
- Invalidate all other active sessions after a successful password change

**Request**
```http
POST /api/v1/student/auth/change-password
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@456",
  "confirmPassword": "NewPass@456"
}
```

**Response `200`**
```json
{
  "data": {
    "message": "Password updated successfully"
  }
}
```

**Errors**

| Code | HTTP | Trigger |
|---|---|---|
| `UNAUTHORIZED` | 401 | Current password is incorrect |
| `VALIDATION_ERROR` | 422 | Password doesn't meet requirements or confirm mismatch |
| `RATE_LIMITED` | 429 | More than 5 attempts in 15 minutes |

---

### 7.4 Supported Locales

#### `GET /api/v1/config/locales`

Returns the list of supported languages for the language selector dropdown on the settings screen.

**Auth:** None (public endpoint)

**Request**
```http
GET /api/v1/config/locales
```

**Response `200`**
```json
{
  "data": {
    "locales": [
      { "code": "en", "label": "English" },
      { "code": "yo", "label": "Yoruba" },
      { "code": "ha", "label": "Hausa" },
      { "code": "ig", "label": "Igbo" }
    ]
  }
}
```

**Notes**
- This endpoint is public and should be heavily cached (CDN or Cloudflare edge — TTL 24h)
- Locale list is school-agnostic; it reflects what the EduConnect platform supports, not per-school configuration

---

## 8. Schema Discrepancies & Fixes

All discrepancies identified between the Figma designs and the initial backend spec. Each has been resolved in this document — the table below serves as a record for frontend/backend alignment.

| # | Screen | Issue | Fix Applied |
|---|---|---|---|
| 1 | Dashboard Overview | 4th card renders class name ("Primary 5") — no `currentClass` field existed in `overview` | Added `"currentClass": string` to `overview` in `GET /student/dashboard` |
| 2 | Timetable | "Left Point" column in Figma grid had no backend field | Added `"locationCode": string \| null` to each timetable slot |
| 3 | Timetable | Figma renders actual calendar date per row, not just day name | Added `"date": "YYYY-MM-DD"` to each day object, computed from `week` param |
| 4 | My Academics | "Current Grade No." column implies raw score, not percentage — backend only had `currentGradePercent` | Added `"rawScore"` and `"maxScore"` to each subject object |
| 5 | Assignments | Countdown timer breaks on page refresh if only `secondsRemaining` is stored | Added `"nextDueAt"` ISO timestamp to `countdown` object so frontend can recompute |
| 6 | Student Profile | Single edit button implies full-form editability; backend only allows 3 fields | Documented allowlist clearly; frontend must lock non-editable fields |
| 7 | Settings | Language dropdown needs a list of supported options; backend only stored the current value string | Added `GET /api/v1/config/locales` (public, cacheable) |

---

## 9. Error Reference

All error responses follow this envelope:

```json
{
  "error": {
    "code": "ASSIGNMENT_NOT_FOUND",
    "message": "The requested assignment does not exist or is not accessible.",
    "statusCode": 404
  }
}
```

| Code | HTTP | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, expired, or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role |
| `NOT_FOUND` | 404 | Resource doesn't exist or belongs to another student |
| `ALREADY_SUBMITTED` | 409 | Assignment already has a submission from this student |
| `DEADLINE_PASSED` | 409 | Submission attempted after `dueAt` with late submissions disabled |
| `FILE_TOO_LARGE` | 413 | Upload exceeds per-file or total size limit |
| `VALIDATION_ERROR` | 422 | Request body or params failed schema validation |
| `RATE_LIMITED` | 429 | Too many requests on a sensitive endpoint |
| `INTERNAL_ERROR` | 500 | Unexpected server error — never expose stack traces or internals |

---

## 10. Implementation Notes

**Row-level security**
Every query must filter by `student_id` derived from the decoded JWT — never from a client-supplied query param. This applies to every single endpoint in this document. A student must never be able to read another student's data by guessing a UUID.

**Active term resolution**
Any endpoint that defaults to "active term" resolves it server-side:
```sql
SELECT id FROM terms
WHERE is_active = true AND school_id = $schoolId
LIMIT 1
```
Cache this result per `school_id` — it changes at most three times a year.

**File uploads**
Stream directly to Supabase Storage (or Cloudflare R2). Never buffer a full upload in Express memory. Use `busboy` for streaming. `multer` with `memoryStorage` is acceptable only for files confirmed under 1MB (e.g. avatar uploads).

**Pagination**
All list endpoints use offset pagination. Max `limit` of 50 on all endpoints. Never return unbounded arrays.

**Route registration order in Express**
Register static path segments before param segments:
```js
// Correct
router.patch('/notifications/read-all', ...)
router.patch('/notifications/:id/read', ...)

// Wrong — read-all will never be reached
router.patch('/notifications/:id/read', ...)
router.patch('/notifications/read-all', ...)
```

**Sensitive fields**
Never return: `password_hash`, raw Supabase auth `user_id` unless it IS the `studentId`, school-level admin config, or any other student's data.

**Caching recommendations**

| Endpoint | Strategy | TTL |
|---|---|---|
| `GET /student/me` | Client session cache | Until logout |
| `GET /student/dashboard` | Per-student server cache | 5 min |
| `GET /student/terms` | Per-school server cache | 1 day |
| `GET /config/locales` | CDN / Cloudflare edge | 24 h |
| `GET /student/timetable` | Per-student, per-week | 1 h |
| `GET /student/notifications` | No cache — must be fresh | — |
