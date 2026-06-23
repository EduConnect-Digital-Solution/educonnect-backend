# New Grading & Scoring — Backend API Reference
## Policy Authoring Mode: Teacher-Delegated Policies

This document is for the **backend developer**. It lists every new and changed endpoint required to support teacher-defined assessment policies. No frontend detail is included here.

---

## 1. Overview

Currently the backend has no concept of "who created a policy". The frontend assumes admin creates all policies. The new feature allows an admin to grant specific teachers the right to create and manage their own policies for a specific class. Backend must:

1. Track which teachers have been granted this permission (new table).
2. Extend `assessment_policies` to record whether a policy was created by admin or teacher.
3. Expose new CRUD endpoints for admin (permission management) and teacher (policy management).
4. **Fully isolate** teacher-delegated classes from admin-created policies: when a teacher has a `teacher_policy_permission` record for their class, admin-defined policies MUST NOT be returned by `GET /api/teacher/effective-policy` for that class — regardless of whether the teacher has created their own policy yet.

---

## 2. Data Model Additions

### New table: `teacher_policy_permissions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `teacherId` | uuid FK → users | |
| `classId` | uuid FK → classes | Permission is class-level only, never arm-level |
| `grantedBy` | uuid FK → users (admin) | |
| `grantedAt` | timestamptz | Default `NOW()` |

Unique constraint: `(teacherId, classId)` — one permission per teacher × class pair.

Deleting a record does **not** cascade-delete the teacher's existing policies. Orphaned teacher policies simply stop being applied in resolution until a new permission is granted.

### Extended table: `assessment_policies`

Add these columns (back-fill existing rows with the defaults shown):

| New Column | Type | Default | Notes |
|---|---|---|---|
| `createdByRole` | enum `'admin'` \| `'teacher'` | `'admin'` | Back-fill all existing rows with `'admin'` |
| `createdByTeacherId` | uuid? | `null` | FK → users, only set for teacher-created policies |
| `scopedClassId` | uuid? | `null` | For teacher policies: the class they are permanently scoped to |

---

## 3. Updated Effective-Policy Resolution

Endpoint: `GET /api/teacher/effective-policy?className=&subjectName=`

### 3.1 Isolation rule (CRITICAL)

**Before running any resolution logic**, the backend MUST check whether the requesting teacher has a row in `teacher_policy_permissions` where `teacherId = currentUser.id AND classId` matches the requested class.

| Permission record exists? | Behaviour |
|---|---|
| **Yes** | Skip ALL admin-created policies entirely. Only evaluate teacher-created policies (steps 1–2 below). If none match, return `policy: null, hasPermission: true`. NEVER fall through to admin policies. |
| **No**  | Ignore teacher policies entirely. Run the standard admin resolution (steps 3–7 below). Return `policy: <resolved>, hasPermission: false`. |

This ensures a teacher with delegation permission sees a clear "you need to create a policy" state rather than silently inheriting an admin policy they are supposed to be overriding.

### 3.2 Resolution order within each branch

**Teacher-delegated branch** (only evaluated when permission record exists):

1. Teacher policy: `scope = 'subject_class'` AND `scopeName` = requested `subjectName` (most specific)
2. Teacher policy: `scope = 'arm'` AND `scopeId` = teacher's current arm
3. Teacher policy: `scope = 'class'` (applies to all arms in the teacher's class)
→ If none match: return `{ policy: null, hasPermission: true }`

**Admin branch** (only evaluated when NO permission record exists):

4. Admin policy: `subject_class` scope (subject × class)
5. Admin policy: `subject` scope
6. Admin policy: `arm` scope
7. Admin policy: `class` scope
8. Admin policy: `school` scope (fallback)
→ If none match: return `{ policy: null, hasPermission: false }`

### 3.3 Updated response shape

Add two new fields to the existing policy response (backwards-compatible — old clients that don't read these fields are unaffected):

```json
{
  "policy": { ... } | null,
  "source": "teacher" | "admin" | null,
  "hasPermission": true | false
}
```

`source = null` means no policy was found in either branch. `hasPermission` tells the frontend which UX state to display when `policy` is null.

---

## 4. Existing Endpoints That Change Behaviour

### `GET /api/admin/assessment-policies`

Now returns both admin-created and teacher-created policies in one list.

**New fields added to every policy object:**

```json
{
  "createdByRole": "teacher",
  "createdByTeacherId": "fa616111-ed64-4b51-8e1c-ae6854fc6e0f",
  "createdByTeacherName": "Kenechukwu Ajufo",
  "scopedClassId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703",
  "scopedClassName": "SS 2"
}
```

For admin-created policies all four new fields are `null` except `createdByRole = "admin"`.

---

## 5. New Admin Endpoints

### `GET /api/admin/policy-permissions`

List all teacher policy permission records.

**Response `200`:**
```json
{
  "permissions": [
    {
      "id": "perm_001",
      "teacherId": "fa616111-...",
      "teacherName": "Kenechukwu Ajufo",
      "classId": "e4d61b2d-...",
      "className": "SS 2",
      "grantedAt": "2026-06-20T10:00:00.000Z",
      "policyCount": 1
    }
  ]
}
```

`policyCount` = number of `assessment_policies` rows where `createdByTeacherId = teacherId AND scopedClassId = classId`.

---

### `POST /api/admin/policy-permissions`

Grant a teacher permission to create policies for a class.

**Request body:**
```json
{
  "teacherId": "fa616111-ed64-4b51-8e1c-ae6854fc6e0f",
  "classId": "e4d61b2d-e50c-41cc-b442-bf7e3f099703"
}
```

**Response `201`:**
```json
{
  "permission": {
    "id": "perm_003",
    "teacherId": "fa616111-...",
    "teacherName": "Kenechukwu Ajufo",
    "classId": "e4d61b2d-...",
    "className": "SS 2",
    "grantedAt": "2026-06-23T11:00:00.000Z",
    "policyCount": 0
  }
}
```

**Error `409`:** permission already exists for this teacher + class pair.
```json
{ "error": "Permission already exists for this teacher and class." }
```

---

### `DELETE /api/admin/policy-permissions/:permissionId`

Revoke a teacher's permission. Does NOT delete their existing policies.

**Response `200`:**
```json
{ "revoked": true }
```

---

### `GET /api/admin/teacher-policies`

Read-only admin view of all policies created by teachers.

**Query params:** `classId` (optional — filter by class)

**Response `200`:**
```json
{
  "policies": [
    {
      "id": "tpol_001",
      "name": "SS 2 Standard (40 CA / 60 Exam)",
      "caComponents": [
        { "id": "tcomp_001", "name": "1st CA Test", "maxScore": 15, "sortOrder": 0 },
        { "id": "tcomp_002", "name": "2nd CA Test", "maxScore": 15, "sortOrder": 1 },
        { "id": "tcomp_003", "name": "Project Work", "maxScore": 10, "sortOrder": 2 }
      ],
      "caMax": 40,
      "examMax": 60,
      "total": 100,
      "assignments": [
        {
          "id": "tassign_001",
          "scope": "class",
          "scopeId": "e4d61b2d-...",
          "scopeName": "SS 2"
        }
      ],
      "createdByTeacherId": "fa616111-...",
      "createdByTeacherName": "Kenechukwu Ajufo",
      "scopedClassId": "e4d61b2d-...",
      "scopedClassName": "SS 2",
      "createdAt": "2026-06-21T09:00:00.000Z",
      "updatedAt": "2026-06-21T09:00:00.000Z"
    }
  ]
}
```

---

## 6. New Teacher Endpoints

All teacher endpoints require `Authorization: Bearer <teacherToken>`. The backend must validate that the requesting user is a teacher AND has a `teacher_policy_permission` record for the relevant class (except `GET /api/teacher/my-policy-permission`).

---

### `GET /api/teacher/my-policy-permission`

Check if the authenticated teacher has been granted policy-creation permission.

**Response `200` (granted):**
```json
{
  "granted": true,
  "permissionId": "perm_001",
  "classId": "e4d61b2d-...",
  "className": "SS 2",
  "grantedAt": "2026-06-20T10:00:00.000Z"
}
```

**Response `200` (not granted):**
```json
{ "granted": false }
```

---

### `GET /api/teacher/my-policies`

List all assessment policies created by the authenticated teacher. Filtered server-side to only this teacher's policies (`createdByTeacherId = currentUser.id`).

**Response `200`:** Same shape as `GET /api/admin/assessment-policies` but pre-filtered. No `createdByRole` field needed — all are teacher-created by definition.

**Error `403`:** Teacher has no `teacher_policy_permission` record.

---

### `POST /api/teacher/my-policies`

Create a new policy. Backend automatically sets `createdByTeacherId = currentUser.id`, `createdByRole = 'teacher'`, and `scopedClassId` from the teacher's permission record.

**Request body:** (identical shape to `POST /api/admin/assessment-policies`)
```json
{
  "name": "SS 2 Custom (40 CA / 60 Exam)",
  "description": "Optional",
  "caComponents": [
    { "name": "1st CA Test", "maxScore": 15, "sortOrder": 0 },
    { "name": "2nd CA Test", "maxScore": 15, "sortOrder": 1 },
    { "name": "Project",     "maxScore": 10, "sortOrder": 2 }
  ],
  "examMax": 60
}
```

**Validation:** CA components total + examMax must equal 100.

**Response `201`:** `{ "policy": { ...full policy object... } }`

**Error `403`:** Teacher has no `teacher_policy_permission` record.

---

### `PUT /api/teacher/my-policies/:policyId`

Update a teacher's own policy definition. Body shape identical to create.

**Error `403`:** Policy belongs to a different teacher.
**Error `409`:** Policy has active (submitted or approved) score sheets referencing it; definition is locked.

**Response `200`:** `{ "policy": { ...updated policy... } }`

---

### `DELETE /api/teacher/my-policies/:policyId`

Delete a teacher's own policy. Reject if any score sheets reference it.

**Response `200`:** `{ "deleted": true }`

---

### `POST /api/teacher/my-policies/:policyId/assignments`

Assign a policy to a scope within the teacher's class. Allowed scopes:

| `scope` value | Meaning | Required fields |
|---|---|---|
| `class` | All arms in teacher's granted class | None — backend fills `scopeId`/`scopeName` from permission record |
| `arm` | Specific arm within teacher's class | `scopeId` (armId), `scopeName` (arm name e.g. `"A"`) |
| `subject_class` | Specific subject the teacher teaches, across all arms | `scopeId` (subjectId), `scopeName` (subject name) |

**Request body:**
```json
{
  "scope": "arm",
  "scopeId": "arm-uuid-here",
  "scopeName": "A"
}
```

**Validation:**
- `scope` must be one of `class`, `arm`, `subject_class`.
- Backend must verify the `scopeId` (arm or subject) belongs to the teacher's permitted class.
- `school` and global `subject` scopes are not allowed for teacher policies — return `400`.

**Response `201`:**
```json
{
  "assignment": {
    "id": "tassign_003",
    "scope": "arm",
    "scopeId": "arm-uuid-here",
    "scopeName": "A",
    "secondaryScopeId": null,
    "secondaryScopeName": null
  }
}
```

---

### `DELETE /api/teacher/my-policies/:policyId/assignments/:assignmentId`

Remove a scope assignment from a teacher's policy.

**Response `200`:** `{ "removed": true }`
