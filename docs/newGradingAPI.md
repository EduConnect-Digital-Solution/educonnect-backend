# New Grading System — Backend API Specification

Generated: 2026-06-24  
Branch: `Playground-Implementation`  
Author: Architecture handoff for backend team

---

## Overview

The grading system has been redesigned from a **bulk, approval-gated** model to an **incremental, audit-only** model that reflects how grading actually happens in schools throughout a term.

### Core shift

| Old model | New model |
|---|---|
| Teacher enters all CA + Exam scores at once | Teacher records one assessment at a time, throughout the term |
| Each CA component = one score | Each CA component = multiple assessment entries that sum to the component total |
| Exam = one score | Exam = one or more assessment entries (Mid-Term, Final, Practical, etc.) |
| Submit → Admin approves or returns | No submission or approval — teacher can edit any time |
| `draft / submitted / returned / approved` | `not_started / in_progress / completed` |

---

## New Status Model

Replace the five-state status with three states:

| Status | Meaning |
|---|---|
| `not_started` | Teacher has not recorded any assessments for this subject yet |
| `in_progress` | Teacher has recorded at least one assessment entry |
| `completed` | All policy components are fully allocated (sum of contribution points = component max) |

**Migration note:** The existing `submissions/matrix` endpoint currently returns `draft / submitted / returned / approved`. These should be migrated to the new three-state model. In the interim, the frontend normalises legacy statuses: `draft / submitted / returned → in_progress`, `approved → completed`.

The matrix response currently includes an `entries` array per subject cell (bulk caScores + examScore per student). **This field is no longer consumed by the frontend** — the new `AuditDrawer` fetches assessment detail via `GET /api/admin/grading-activity` instead. The `entries` field should be dropped from the matrix response once the new model is live, since serialising full student score objects for every cell in the matrix is expensive and the data is no longer used.

---

## Data Structures

### AssessmentEntry

```json
{
  "id": "ae_001",
  "policyComponentId": "comp_abc123",
  "policyComponentName": "1st CA Test",
  "componentType": "ca",
  "title": "Class Test 1",
  "assessmentType": "Class Test",
  "className": "SS 2",
  "subjectName": "English Language",
  "termId": "term_xyz789",
  "maxObtainableScore": 70,
  "contributionPoints": 8,
  "createdBy": "teacher_uuid",
  "createdAt": "2026-06-10T09:00:00.000Z",
  "updatedAt": "2026-06-10T11:30:00.000Z",
  "scores": [
    {
      "studentId": "student_uuid",
      "studentName": "Adaeze Okafor",
      "scoreObtained": 56,
      "calculatedContribution": 6.4
    }
  ]
}
```

**Field notes:**
- `maxObtainableScore` — what the test was physically marked out of (e.g. 70). Raw student scores are entered against this.
- `contributionPoints` — how many points this entry contributes toward the component's allocation (e.g. 8 out of 15). Must satisfy: `SUM(contributionPoints for component) ≤ component.maxScore`.
- `calculatedContribution` — computed on read: `(scoreObtained / maxObtainableScore) × contributionPoints`. Never stored.
- `componentType` — `ca` for CA components, `exam` for exam entries. Use `policyComponentId = "exam"` as a sentinel for exam-type entries.

### GradingActivitySummary (admin audit)

```json
{
  "className": "SS 2",
  "armName": "A",
  "subjectName": "English Language",
  "termId": "term_xyz789",
  "teacherName": "Kenechukwu Ajufo",
  "lastUpdated": "2026-06-20T14:00:00.000Z",
  "overallStatus": "in_progress",
  "policy": {
    "name": "SS 2 Standard (40 CA / 60 Exam)",
    "caComponents": [
      { "id": "comp_001", "name": "1st CA Test",  "maxScore": 15 },
      { "id": "comp_002", "name": "2nd CA Test",  "maxScore": 15 },
      { "id": "comp_003", "name": "Project Work", "maxScore": 10 }
    ],
    "examMax": 60
  },
  "componentProgress": [
    { "componentId": "comp_001", "componentName": "1st CA Test",  "maxScore": 15, "usedPoints": 15, "entries": 2 },
    { "componentId": "comp_002", "componentName": "2nd CA Test",  "maxScore": 15, "usedPoints": 5,  "entries": 1 },
    { "componentId": "comp_003", "componentName": "Project Work", "maxScore": 10, "usedPoints": 0,  "entries": 0 },
    { "componentId": "exam",     "componentName": "Exam",         "maxScore": 60, "usedPoints": 0,  "entries": 0 }
  ],
  "entries": [
    {
      "id": "ae_001",
      "title": "Class Test 1",
      "assessmentType": "Class Test",
      "componentName": "1st CA Test",
      "componentId": "comp_001",
      "contributionPoints": 8,
      "studentsGraded": 36,
      "createdAt": "2026-06-10T09:00:00.000Z",
      "updatedAt": "2026-06-10T11:30:00.000Z"
    }
  ]
}
```

---

## New Endpoints — Teacher

### GET `/api/teacher/assessment-entries`

List all assessment entries for a class/subject/term.

**Query params:** `className`, `subjectName`, `termId`

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [ /* AssessmentEntry[] */ ]
  }
}
```

---

### POST `/api/teacher/assessment-entries`

Create a new assessment entry. No scores are included — scores are saved via the `/scores` endpoint.

**Request body:**
```json
{
  "policyComponentId": "comp_abc123",
  "policyComponentName": "1st CA Test",
  "componentType": "ca",
  "title": "Class Test 2",
  "assessmentType": "Class Test",
  "className": "SS 2",
  "subjectName": "English Language",
  "termId": "term_xyz789",
  "maxObtainableScore": 70,
  "contributionPoints": 8
}
```

**Validation:**
- `title` required, max 100 chars
- `maxObtainableScore` must be > 0
- `contributionPoints` must be > 0
- `SUM(contributionPoints for policyComponentId) + contributionPoints` must not exceed the component's `maxScore` from the assigned policy
- Teacher must be assigned to `className` / `subjectName`

**Response:**
```json
{
  "success": true,
  "data": {
    "entry": { /* AssessmentEntry (scores: []) */ }
  }
}
```

---

### PUT `/api/teacher/assessment-entries/:id`

Update an assessment entry's metadata. Use the `/scores` endpoint to update student scores.

**Request body** (all fields optional):
```json
{
  "title": "Class Test 2 (revised)",
  "assessmentType": "Class Test",
  "maxObtainableScore": 80,
  "contributionPoints": 7
}
```

**Constraints:**
- Cannot change `policyComponentId`, `className`, `subjectName`, `termId`
- If `contributionPoints` changes, re-validate that the new sum does not exceed component max (excluding this entry)

**Response:**
```json
{
  "success": true,
  "data": {
    "entry": { /* Updated AssessmentEntry */ }
  }
}
```

---

### DELETE `/api/teacher/assessment-entries/:id`

Permanently deletes an assessment entry and all its student scores.

**Response:**
```json
{
  "success": true,
  "data": { "deleted": true }
}
```

---

### POST `/api/teacher/assessment-entries/:id/scores`

Save (replace) student scores for an assessment entry. Sends the full scores array — not a partial update.

**Request body:**
```json
{
  "scores": [
    {
      "studentId": "student_uuid",
      "studentName": "Adaeze Okafor",
      "scoreObtained": 56
    }
  ]
}
```

**Validation:**
- `scoreObtained` must be between 0 and `entry.maxObtainableScore`
- `studentId` must be enrolled in the entry's `className` and `subjectName`

**Response:**
```json
{
  "success": true,
  "data": {
    "entry": { /* Full AssessmentEntry with updated scores and calculatedContribution */ }
  }
}
```

---

## New Endpoints — Admin

### GET `/api/admin/grading-activity`

Returns audit data for a specific class arm × subject × term. Admin read-only view.

**Query params:** `className`, `armName`, `subjectName`, `termId`

**Response:** `GradingActivitySummary` (see Data Structures above)

**Backend implementation note:**  
Aggregate assessment entries for the given scope. Compute `componentProgress` by summing `contributionPoints` per `policyComponentId`. Derive `overallStatus` from completeness of all components.

---

### GET `/api/admin/submissions/matrix` *(update required)*

Currently returns 5 statuses. Migrate to return 3:

```json
{
  "success": true,
  "data": {
    "termId": "term_xyz789",
    "summary": {
      "total": 120,
      "completed": 45,
      "in_progress": 52,
      "not_started": 23
    },
    "matrix": [
      {
        "armId": "arm_uuid",
        "armName": "A",
        "className": "SS 2",
        "subjects": [
          {
            "subjectId": "subj_uuid",
            "subjectName": "English Language",
            "teacherName": "Kenechukwu Ajufo",
            "status": "in_progress",
            "entryCount": 3,
            "lastUpdated": "2026-06-20T14:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

---

## Endpoints to Remove

These endpoints implement the old approval workflow and must be removed or deprecated once the new model is live:

| Method | Route | Reason |
|--------|-------|--------|
| `POST` | `/api/admin/submissions/:id/approve` | Approval workflow removed |
| `POST` | `/api/admin/submissions/:id/return` | Return workflow removed |
| `POST` | `/api/teacher/score-sheets/:sheetId/submit` | Submission step removed |

**Migration path:**
1. Deploy new assessment entry endpoints first
2. Update frontend to use new endpoints (already done in this branch)
3. Retire submission/approval endpoints in a subsequent backend deploy
4. Old `/api/teacher/score-sheets` endpoints can be left in place temporarily — they are unused after this frontend migration

---

## Endpoints to Keep (Unchanged)

These endpoints are unaffected by the new grading model:

| Endpoint | Status |
|---|---|
| `GET/POST /api/admin/grading-scales` | Keep as-is |
| `GET/PUT/DELETE /api/admin/grading-scales/:id` | Keep as-is |
| `/api/admin/grading-scales/:id/bands` (all) | Keep as-is |
| `GET/POST /api/admin/assessment-policies` | Keep as-is |
| `PUT/DELETE /api/admin/assessment-policies/:id` | Keep as-is |
| `/api/admin/assessment-policies/:id/assignments` (all) | Keep as-is |
| `GET /api/admin/broadsheets` | Keep (see note below) |
| `GET /api/admin/results/publish-status` | Keep |
| `POST /api/admin/results/publish` | Keep |
| `POST /api/admin/results/generate-pdfs` | Keep |
| `GET /api/admin/results/pdf-jobs/:jobId` | Keep |
| `/api/admin/report-cards/*` (all) | Keep as-is |
| `GET /api/teacher/effective-policy` | Keep as-is |
| `GET /api/teacher/my-policy-permission` | Keep as-is |
| `/api/teacher/my-policies` (all) | Keep as-is |

---

## Broadsheet Compilation — Updated Logic

Previously the broadsheet required ALL sheets to have status `approved`.

In the new model, the broadsheet should compile when:
- All CA components for a subject/arm have `usedPoints === maxScore` (fully allocated)
- All student scores for all entries have been entered

**Recommended approach:** Instead of blocking on a single approval event, compute a "grading complete" flag per subject/arm by checking if `SUM(contributionPoints) === component.maxScore` for every component in the policy, and all enrolled students have a score for all entries.

For the `readiness` field in the broadsheet response, replace `allApproved` with `allComplete`:

```json
{
  "readiness": {
    "allComplete": false,
    "total": 12,
    "complete": 8,
    "pending": [
      { "subjectName": "Mathematics", "status": "in_progress", "completionPct": 60 }
    ]
  }
}
```

---

## Score Computation

When a student's final score for a subject is needed (for the broadsheet or report card):

```
CA Total = SUM(
  (scoreObtained / maxObtainableScore) × contributionPoints
  for each entry WHERE componentType = 'ca'
)

Exam Total = SUM(
  (scoreObtained / maxObtainableScore) × contributionPoints
  for each entry WHERE componentType = 'exam'
)

Final Score = CA Total + Exam Total
```

Round `calculatedContribution` to 2 decimal places at the entry level.  
Round `CA Total` and `Exam Total` to 1 decimal place at the subject level.  
Round `Final Score` to the nearest integer for the broadsheet.

---

## Permission & Auth Notes

- Teachers can only create/update/delete assessment entries for classes and subjects they are assigned to
- A teacher with policy delegation for a class can only see their own policy — admin policies do not apply (existing isolation rule, unchanged)
- Admins can read all grading activity but cannot create or modify assessment entries
- Assessment entries inherit the teacher's auth context — `createdBy` is set server-side from the JWT, not sent by client

---

## Migration Checklist for Backend

- [ ] Create `assessment_entries` table with fields: id, policy_component_id, component_type, title, assessment_type, class_name, subject_name, term_id, max_obtainable_score, contribution_points, created_by, created_at, updated_at
- [ ] Create `assessment_scores` table: id, entry_id (FK), student_id (FK), score_obtained, created_at, updated_at
- [ ] Implement `GET /api/teacher/assessment-entries`
- [ ] Implement `POST /api/teacher/assessment-entries` with contribution validation
- [ ] Implement `PUT /api/teacher/assessment-entries/:id`
- [ ] Implement `DELETE /api/teacher/assessment-entries/:id`
- [ ] Implement `POST /api/teacher/assessment-entries/:id/scores`
- [ ] Implement `GET /api/admin/grading-activity`
- [ ] Update `GET /api/admin/submissions/matrix` to use three-state status model
- [ ] Update broadsheet compilation logic (replace allApproved with allComplete)
- [ ] Add `entryCount` and `lastUpdated` fields to matrix response cells
- [ ] Deprecate `/api/admin/submissions/:id/approve`
- [ ] Deprecate `/api/admin/submissions/:id/return`
- [ ] Deprecate `POST /api/teacher/score-sheets/:sheetId/submit`
