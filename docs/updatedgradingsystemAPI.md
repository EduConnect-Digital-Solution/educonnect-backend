# Grading System — Backend API Specification


## Table of contents

2. [Assessment Policies (Admin)](#2-assessment-policies-admin--mocked) — 🟡
3. [Effective Policy (Teacher)](#3-effective-policy-teacher--mocked) — 🟡
4. [Score Sheets (Teacher)](#4-score-sheets-teacher--mocked) — 🟡
5. [Submission Matrix & Moderation (Admin)](#5-submission-matrix--moderation-admin--mocked) — 🟡
6. [Master Broadsheet (Admin)](#6-master-broadsheet-admin--mocked) — 🟡
7. [Result Publishing (Admin)](#7-result-publishing-admin--mocked) — 🟡
8. [Report Cards (Admin)](#8-report-cards-admin--mocked) — 🟡
9. [Reused existing endpoints](#9-reused-existing-endpoints--live)
10. [Shared data models](#10-shared-data-models)

---

## 2. Assessment Policies (Admin) — 🟡 MOCKED

### 2.1 List policies

```
GET /api/admin/assessment-policies
```
**Purpose:** Return every assessment policy with its components and assignments.
**Params:** none.
**Response:**
```json
{
  "success": true,
  "data": {
    "policies": [{
      "id": "uuid",
      "name": "Standard Secondary",
      "description": "Used for JSS1–SS3 core subjects",
      "caComponents": [
        { "id": "uuid", "name": "Test 1", "maxScore": 10, "sortOrder": 0 },
        { "id": "uuid", "name": "Test 2", "maxScore": 10, "sortOrder": 1 },
        { "id": "uuid", "name": "Assignment", "maxScore": 10, "sortOrder": 2 }
      ],
      "caMax": 30,
      "examMax": 70,
      "total": 100,
      "assignments": [{
        "id": "uuid",
        "scope": "class",
        "scopeId": "class-uuid",
        "scopeName": "JSS2",
        "secondaryScopeId": null,
        "secondaryScopeName": null
      }],
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-01-10T00:00:00.000Z"
    }]
  }
}
```

### 2.2 Create policy

```
POST /api/admin/assessment-policies
```
**Purpose:** Create a policy. Assignments are added separately (see 2.5).
**Body:**
```json
{
  "name": "Standard Secondary",
  "description": "optional",
  "caComponents": [
    { "name": "Test 1", "maxScore": 10, "sortOrder": 0 },
    { "name": "Assignment", "maxScore": 20, "sortOrder": 1 }
  ],
  "examMax": 70
}
```
**Validation:** every component needs a non-empty `name` and `maxScore > 0`;
`sum(caComponents.maxScore) + examMax === 100`.
**Response:** `{ success, data: { policy: { ...full policy object, assignments: [] } } }`
(compute and return `id` per component, `caMax`, `total`).

### 2.3 Update policy

```
PUT /api/admin/assessment-policies/:id
```
**Purpose:** Edit the policy definition (not its assignments).
**Body:** `{ name?, description?, caComponents?, examMax? }` (same component shape as create).
**Response:** `{ success, data: { policy: { ...updated policy object } } }`

### 2.4 Delete policy

```
DELETE /api/admin/assessment-policies/:id
```
**Purpose:** Delete a policy.
**Behaviour:** **Reject with HTTP 409** if the policy has active assignments
(the UI surfaces the message). Otherwise remove it.
**Response:** `{ success: true, message: "Policy deleted." }`

### 2.5 Add assignment

```
POST /api/admin/assessment-policies/:id/assignments
```
**Purpose:** Attach the policy to a scope. Use `scope: "school"` for the school-wide default.
**Body:**
```json
{
  "scope": "subject_class",
  "scopeId": "subject-uuid",
  "scopeName": "Mathematics",
  "secondaryScopeId": "class-uuid",
  "secondaryScopeName": "JSS2"
}
```
**Field rules by scope:**

| `scope` | `scopeId` / `scopeName` | `secondaryScopeId` / `secondaryScopeName` |
|---------|--------------------------|-------------------------------------------|
| `school` | `null` | `null` |
| `class` | classId / class name | `null` |
| `arm` | armId / arm name | `null` |
| `subject` | subjectId / subject name | `null` |
| `subject_class` | subjectId / subject name | classId / class name |

**Response:** `{ success, data: { assignment: { id, scope, scopeId, scopeName, secondaryScopeId, secondaryScopeName } } }`

### 2.6 Remove assignment

```
DELETE /api/admin/assessment-policies/:id/assignments/:assignmentId
```
**Purpose:** Detach one scope assignment.
**Response:** `{ success: true, message: "Assignment removed." }`

---

## 3. Effective Policy (Teacher) — 🟡 MOCKED

> Used by: **Teacher → Score Entry.** Resolves which policy governs a given class+subject
> by walking the scope priority. This is the single most important resolver — the returned
> `caComponents` become the exact score-entry columns the teacher sees.

```
GET /api/teacher/effective-policy?className={className}&subjectName={subjectName}
```
**Purpose:** Return the most specific policy assigned for this class/subject pair.
**Resolution order:** `subject_class > subject > arm > class > school (default)`.
**Query params:** `className` (string), `subjectName` (string).
**Response (policy found):**
```json
{
  "success": true,
  "data": {
    "policy": {
      "id": "uuid",
      "name": "Standard Secondary",
      "caComponents": [
        { "id": "uuid", "name": "Test 1", "maxScore": 10, "sortOrder": 0 }
      ],
      "caMax": 30,
      "examMax": 70
    }
  }
}
```
**Response (no policy at any scope):** `{ "success": true, "data": { "policy": null } }`
→ The UI shows a blocking "no policy assigned" banner and hides the grid.

---

## 4. Score Sheets (Teacher) — 🟡 MOCKED

> Used by: **Teacher → Score Entry.** A score sheet is one class+subject+term grid.
> Lifecycle: `draft → submitted → (returned → submitted)* → approved`.
> Entries are keyed by `studentId`; CA scores are keyed by **`caComponent.id`** (from §3).

**Sheet status values:** `draft | submitted | returned | approved`
**Entry shape:** `{ studentId, caScores: { [componentId]: number }, examScore: number }`

### 4.1 Get score sheet

```
GET /api/teacher/score-sheets?className={className}&subjectName={subjectName}&termId={termId}
```
**Purpose:** Fetch the existing sheet for this class/subject/term, or `null` if none yet.
**Response (exists):**
```json
{
  "success": true,
  "data": {
    "sheet": {
      "id": "uuid",
      "status": "draft",
      "returnNote": null,
      "entries": [
        { "studentId": "uuid", "caScores": { "<componentId>": 8 }, "examScore": 55 }
      ],
      "submittedAt": null,
      "updatedAt": "2026-01-10T00:00:00.000Z"
    }
  }
}
```
**Response (none):** `{ "success": true, "data": { "sheet": null } }`

### 4.2 Create score sheet

```
POST /api/teacher/score-sheets
```
**Purpose:** Create an empty draft sheet. Called automatically on the teacher's first
auto-save when no sheet exists yet.
**Body:** `{ "className": "JSS1", "subjectName": "Mathematics", "termId": "uuid" }`
**Response:**
```json
{ "success": true, "data": { "sheet": { "id": "uuid", "status": "draft", "entries": [], "returnNote": null } } }
```

### 4.3 Save entries (auto-save)

```
PUT /api/teacher/score-sheets/:sheetId
```
**Purpose:** Persist the current grid as a draft. **Does not change status.** Called on a
1.5s debounce after the teacher stops typing.
**Body:**
```json
{
  "entries": [
    { "studentId": "uuid", "caScores": { "<componentId>": 8, "<componentId2>": 10 }, "examScore": 55 }
  ]
}
```
**Validation (recommended):** reject scores exceeding each component's `maxScore` or
`examMax`. The UI also guards this, but the server is the source of truth.
**Response:** `{ "success": true, "data": { "sheet": { "id": "uuid", "status": "draft", "updatedAt": "…" } } }`

### 4.4 Submit for review

```
POST /api/teacher/score-sheets/:sheetId/submit
```
**Purpose:** Transition `draft` (or `returned`) → `submitted` for admin moderation.
After submit the sheet is read-only to the teacher until returned/approved.
**Body:** none.
**Behaviour:** validate no entry exceeds policy maxima before accepting.
**Response:** `{ "success": true, "data": { "sheet": { "id": "uuid", "status": "submitted", "submittedAt": "…" } } }`

---

## 5. Submission Matrix & Moderation (Admin) — 🟡 MOCKED

> Used by: **Grading & Results → Submission Matrix tab.** A traffic-light grid of every
> Arm × Subject sheet for a term, plus approve / return-with-note moderation.

### 5.1 Get matrix

```
GET /api/admin/submissions/matrix?termId={termId}
```
**Purpose:** Return the per-arm, per-subject status grid + summary counts for a term.
**Query params:** `termId`.
**Response:**
```json
{
  "success": true,
  "data": {
    "termId": "uuid",
    "summary": {
      "total": 36, "approved": 14, "submitted": 5,
      "draft": 10, "returned": 2, "not_started": 5
    },
    "subjectList": [{ "id": "uuid", "name": "Mathematics" }],
    "matrix": [{
      "armId": "uuid",
      "armName": "JSS1A",
      "className": "JSS1",
      "subjects": [{
        "subjectId": "uuid",
        "subjectName": "Mathematics",
        "sheetId": "uuid",
        "status": "submitted",
        "teacherName": "Mr. Okafor",
        "updatedAt": "2026-01-10T00:00:00.000Z"
      }]
    }]
  }
}
```
**Status values per cell:** `not_started | draft | submitted | returned | approved`.

### 5.2 Approve a submission

```
POST /api/admin/submissions/:submissionId/approve
```
**Purpose:** Move a `submitted` sheet → `approved` and lock it (counts in the broadsheet).
`:submissionId` is the `sheetId`.
**Body:** none.
**Response:** `{ "success": true, "data": { "sheet": { "id": "uuid", "status": "approved", "approvedAt": "…" } } }`

### 5.3 Return a submission

```
POST /api/admin/submissions/:submissionId/return
```
**Purpose:** Send a `submitted` sheet back to the teacher for correction. The note is
delivered to the teacher's Score Entry page as an amber banner.
**Body:** `{ "note": "Optional message to the teacher" }`
**Response:** `{ "success": true, "data": { "sheet": { "id": "uuid", "status": "returned", "returnNote": "…" } } }`

---

## 6. Master Broadsheet (Admin) — 🟡 MOCKED

> Used by: **Grading & Results → Master Broadsheet tab.** Consolidated results for one arm
> in one term — every subject, every student, ranked by total.

```
GET /api/admin/broadsheets?armId={armId}&termId={termId}
```
**Purpose:** Compile the broadsheet for an arm/term.
**Query params:** `armId`, `termId`.

**Gating (important):** Only return a fully-populated broadsheet when **every** score sheet
for the arm/term is `approved`. While any are pending, return `readiness.allApproved: false`
and the `pending` list — the UI shows a blocking banner instead of a partial sheet.

**Position:** computed server-side from `totalScore`, descending. **Ties share a position.**

**Response:**
```json
{
  "success": true,
  "data": {
    "armId": "uuid", "armName": "JSS1 A", "className": "JSS1",
    "termId": "uuid", "termName": "First Term",
    "readiness": {
      "allApproved": true,
      "total": 6,
      "approved": 6,
      "pending": [
        { "subjectName": "Mathematics", "status": "submitted" }
      ]
    },
    "subjects": [{ "id": "uuid", "name": "English" }],
    "students": [{
      "id": "uuid",
      "name": "Adaeze Okafor",
      "admissionNo": "ADM/22/001",
      "scores": {
        "<subjectId>": { "ca": 24, "exam": 60, "total": 84, "grade": "A1" }
      },
      "totalScore": 502,
      "average": 83.7,
      "gradePointAverage": 3.85,
      "position": 1
    }]
  }
}
```
> **Backend performance note:** this aggregates across many sheets (100 students × 12
> subjects bottlenecks if computed per-request). Build a materialised view or an
> aggregation job triggered when a sheet is approved.
>
> **No export endpoint needed** — the frontend exports to Excel client-side (Office-XML `.xls`).

---

## 7. Result Publishing (Admin) — 🟡 MOCKED

> Used by: **Grading & Results → Publish Results tab.** Pre-publish checklist → publish
> (locks the term's grades) → optional bulk PDF generation (async job + polling).

### 7.1 Get publish status

```
GET /api/admin/results/publish-status?termId={termId}&classId={classId}
```
**Purpose:** Whether results are already published for this term/class, plus the
pre-publish checklist the UI gates the Publish button on.
**Query params:** `termId`, `classId`.
**Response:**
```json
{
  "success": true,
  "data": {
    "published": false,
    "publishedAt": null,
    "checklist": {
      "allApproved":     { "passed": true, "label": "All score sheets approved", "detail": "…" },
      "schemesAssigned": { "passed": true, "label": "Grading scheme assigned to every subject", "detail": "…" },
      "termDatesSet":    { "passed": true, "label": "Academic term dates are set", "detail": "…" }
    }
  }
}
```
> The Publish button is disabled until **every** checklist item has `passed: true`.
> Each item: `{ passed: boolean, label: string, detail: string }`. You may add more checks —
> the UI renders whatever keys you return.

### 7.2 Publish results

```
POST /api/admin/results/publish
```
**Purpose:** Lock all grades for the term/class and make results eligible for report cards.
**Body:** `{ "termId": "uuid", "classId": "uuid" }`
**Response:** `{ "success": true, "data": { "published": true, "publishedAt": "2026-01-10T12:00:00.000Z" } }`
> Should be idempotent / reject double-publish. Un-publishing is out of scope for now.

### 7.3 Generate result PDFs (async)

```
POST /api/admin/results/generate-pdfs
```
**Purpose:** Kick off bulk PDF generation for the class. Returns a job id to poll.
**Body:** `{ "termId": "uuid", "classId": "uuid" }`
**Response:** `{ "success": true, "data": { "jobId": "job_123" } }`

### 7.4 Poll PDF job

```
GET /api/admin/results/pdf-jobs/:jobId
```
**Purpose:** Poll generation progress. The UI polls every ~600ms until `completed`/`failed`.
**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_123",
    "status": "processing",
    "progress": 45,
    "downloadUrl": null
  }
}
```
`status`: `processing | completed | failed`. On `completed`, return a real `downloadUrl`
(the frontend currently shows a mock download until that URL is live). **This same job
poller is reused by report-card generation (§8.5).**

---

## 8. Report Cards (Admin) — 🟡 MOCKED

> Used by: **Academics → Report Cards** (3 tabs: Template Builder, Comments Worklist,
> Generate & Release). Template config, per-student comments + trait ratings, then a
> generate → sign-off → release-to-parents pipeline.

**Trait list (frontend default):** `["Punctuality", "Conduct", "Neatness", "Participation", "Leadership"]` — ratings are integers 1–5.
**Block types:** `header | student-info | results-table | attendance | traits | comments | signatures`.

### 8.1 Get template

```
GET /api/admin/report-cards/template
```
**Purpose:** Fetch the saved report-card layout (or your default if none saved yet).
**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "orientation": "portrait",
      "accent": "blue",
      "blocks": [
        { "id": "blk_header",  "type": "header",        "label": "School Header & Crest", "enabled": true },
        { "id": "blk_student", "type": "student-info",  "label": "Student Information",    "enabled": true },
        { "id": "blk_results", "type": "results-table", "label": "Results Table",          "enabled": true }
      ]
    }
  }
}
```
`orientation`: `portrait | landscape`. `accent`: `blue | green | purple | amber | slate`.
`blocks` order is significant (render order); `enabled` toggles visibility.

### 8.2 Save template

```
PUT /api/admin/report-cards/template
```
**Purpose:** Persist the layout.
**Body:** the full `template` object (same shape as 8.1's `data.template`).
**Response:** `{ "success": true, "data": { "template": { …saved template } } }`

### 8.3 Get comments worklist

```
GET /api/admin/report-cards/comments?armId={armId}&termId={termId}
```
**Purpose:** One row per student in the arm, with their saved class-teacher comment,
trait ratings, and completion status.
**Query params:** `armId`, `termId`.
**Response:**
```json
{
  "success": true,
  "data": {
    "traits": ["Punctuality", "Conduct", "Neatness", "Participation", "Leadership"],
    "students": [{
      "id": "uuid",
      "name": "Adaeze Okafor",
      "admissionNo": "ADM/22/001",
      "comment": "A focused and well-behaved student.",
      "traits": { "Punctuality": 5, "Conduct": 4 },
      "status": "completed"
    }]
  }
}
```
`status`: `completed` when a comment exists, else `pending`.

### 8.4 Save a student's comment

```
PUT /api/admin/report-cards/comments/:studentId
```
**Purpose:** Save one student's class-teacher comment + trait ratings.
**Body:**
```json
{
  "armId": "uuid",
  "termId": "uuid",
  "comment": "A focused and well-behaved student.",
  "traits": { "Punctuality": 5, "Conduct": 4, "Neatness": 4 }
}
```
**Response:** `{ "success": true, "data": { "studentId": "uuid", "status": "completed" } }`

### 8.5 Generate report cards (async)

```
POST /api/admin/report-cards/generate
```
**Purpose:** Generate a PDF card per student for the arm/term. Async — returns a job id.
**Body:** `{ "armId": "uuid", "termId": "uuid" }`
**Response:** `{ "success": true, "data": { "jobId": "rcjob_123" } }`
> Poll progress via the **shared** `GET /api/admin/results/pdf-jobs/:jobId` endpoint (§7.4).

### 8.6 Principal sign-off

```
POST /api/admin/report-cards/sign-off
```
**Purpose:** Bulk principal sign-off for the arm/term's generated cards.
**Body:** `{ "armId": "uuid", "termId": "uuid" }`
**Response:** `{ "success": true, "data": { "signedOff": true, "signedAt": "…" } }`

### 8.7 Publish to parents

```
POST /api/admin/report-cards/publish
```
**Purpose:** Release signed-off cards to the parent portal. Omit `studentIds` for the
whole arm, or pass a subset for individual release.
**Body:** `{ "armId": "uuid", "termId": "uuid", "studentIds": ["uuid", "uuid"] }` (`studentIds` optional)
**Response:** `{ "success": true, "data": { "publishedCount": 14, "publishedAt": "…" } }`
> **Batch print** is a frontend-only queue action today (no endpoint). If you want a
> server-side print queue, add `POST /api/admin/report-cards/print` with the same body
> as publish and we'll wire it.

---

## 9. Reused existing endpoints — 🟢 LIVE

These already exist and are **reused** by the new screens. No changes needed; listed so the
backend knows the new pages depend on them.

| Method | Path | Used by | Purpose |
|--------|------|---------|---------|
| GET | `/api/teacher/classes` | Score Entry | Teacher's assigned classes |
| GET | `/api/teacher/classes/:className/subjects` | Score Entry | Subjects in a class |
| GET | `/api/teacher/classes/:className/subjects/:subjectName/students` | Score Entry | Students for the grid |
| GET | `/api/academic/classes` | Broadsheet, Publish, Report Cards | Class levels |
| GET | `/api/academic/classes/:classId/arms` | Broadsheet, Report Cards | Arms under a class |
| GET | `/api/academic/subjects` | Assessment Policies | School subjects (for scope picker) |

> ⚠️ The **old** teacher grade endpoints (`/api/teacher/grades*`) power the legacy
> `ClassStudents.jsx` per-student system and are **unrelated** to the new score-sheet
> system. Keep them; do not merge the two.

---

## 10. Shared data models

```ts
// Grade band (Grading Scales — live)
type Band = {
  label: string;        // "A1", "B2", …
  minPercent: number;   // 0–100
  maxPercent: number;   // 0–100
  gradePoints: number;  // e.g. 4.0
  sortOrder: number;
};

// CA component (Assessment Policies)
type CAComponent = {
  id: string;
  name: string;         // "Test 1", "Assignment"
  maxScore: number;     // marks allocated
  sortOrder: number;
};

// Policy scope assignment
type Assignment = {
  id: string;
  scope: 'school' | 'class' | 'arm' | 'subject' | 'subject_class';
  scopeId: string | null;
  scopeName: string | null;
  secondaryScopeId: string | null;    // classId when scope = 'subject_class'
  secondaryScopeName: string | null;
};

// Assessment policy
type Policy = {
  id: string;
  name: string;
  description: string | null;
  caComponents: CAComponent[];
  caMax: number;        // = sum(caComponents.maxScore)
  examMax: number;
  total: number;        // = caMax + examMax, must equal 100
  assignments: Assignment[];
  createdAt: string;
  updatedAt: string;
};

// Score-sheet entry (Teacher Score Entry)
type ScoreEntry = {
  studentId: string;
  caScores: { [componentId: string]: number };   // keyed by CAComponent.id
  examScore: number;
};

type ScoreSheet = {
  id: string;
  status: 'draft' | 'submitted' | 'returned' | 'approved';
  returnNote: string | null;
  entries: ScoreEntry[];
  submittedAt: string | null;
  updatedAt: string;
};

// Broadsheet student row
type BroadsheetStudent = {
  id: string;
  name: string;
  admissionNo: string;
  scores: { [subjectId: string]: { ca: number; exam: number; total: number; grade: string } };
  totalScore: number;
  average: number;
  gradePointAverage: number;
  position: number;     // computed; ties share a position
};

// Async PDF job (results + report cards)
type PdfJob = {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;             // 0–100
  downloadUrl: string | null;   // present when completed
};

// Report-card template
type ReportTemplate = {
  orientation: 'portrait' | 'landscape';
  accent: 'blue' | 'green' | 'purple' | 'amber' | 'slate';
  blocks: { id: string; type: string; label: string; enabled: boolean }[];
};
```

---

### Frontend service files (where each call lives)

| Domain | Service file |
|--------|--------------|
| Grading Scales, Assessment Policies, Submission Matrix, Broadsheet, Publishing, Report Cards | `src/pages/application/AdminDashboard/services/gradingAPIs.js` |
| Effective Policy, Score Sheets | `src/pages/application/TeacherDashboard/services/scoreEntryAPIs.js` |

Each mocked function has the real `apiClient` call commented out directly above its mock
body — going live is a per-function un-comment, no signature changes.
