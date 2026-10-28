# System Admin ("God Mode") — school operations

Everything here is under `/api/system-admin` and needs a **system admin token**
(`POST /api/system-admin/auth/login`). Send it as `Authorization: Bearer <token>`.
A school admin, teacher, parent or student token is refused.

Every action that changes data writes a row to the **audit trail**
(`GET /api/system-admin/audit-logs`) in the same database transaction. If the
audit row cannot be written, the action does not happen.

School IDs in URLs are the human-readable code (`ABC1234`: three letters, four
digits), not the database UUID.

Errors look like `{ "success": false, "message": "...", "code": "SCHOOL_NOT_FOUND" }`.

---

## 1. Oversee

| Method | Path | What it returns |
|--------|------|-----------------|
| GET | `/platform/overview`, `/platform/kpis`, `/metrics/cross-school`, `/system/health` | Platform-wide numbers (already existed) |
| GET | `/schools/management?status=&tier=&search=&page=&limit=` | The school list. `status`: `active`, `inactive`, `archived`, `deleted`, `all`. **Archived and deleted schools are hidden unless you ask.** Password hashes are never returned. |
| GET | `/schools/:schoolId` | One school: profile, subscription, admin, headcounts, teachers not yet invited, pending invitations, archive and delete state |
| GET | `/schools/:schoolId/students?search=&status=&classId=&page=&limit=` | The school's students (`hasLogin` says whether they can sign in) |
| GET | `/schools/:schoolId/staff?search=&status=&role=&page=&limit=` | Teachers and admins. `status`: `not_invited`, `invited`, `active`, `inactive` |
| GET | `/users/management` | Users across all schools (already existed) |
| GET | `/audit-logs?schoolId=&action=&actor=&page=&limit=` | The audit trail, newest first. Filter by `action=school.delete` etc. |

---

## 2. Add a school

`POST /schools`

```json
{
  "schoolName": "Greenfield Academy",
  "email": "head@greenfield.example",
  "password": "optional, at least 10 characters",
  "phone": "08031234567",
  "address": "12 Marina Road, Lagos",
  "principalName": "Mrs Ada Obi",
  "subscriptionTier": "basic",
  "adminUserData": { "firstName": "Ada", "lastName": "Obi" }
}
```

Only `schoolName` and `email` are required. The school gets a generated code
(for example `GRE4821`), starts on a 30-day trial, is verified and active, and
gets an admin user with the same email.

If you leave `password` out, one is generated and returned **once** as
`temporaryPassword`. A password you supply is never echoed back. The admin is
marked as needing to change it on first login.

---

## 3. Switch a school off and on

| Method | Path | Body |
|--------|------|------|
| PUT | `/schools/:schoolId/deactivate` | `{ "reason": "..." }` (10–500 characters) |
| PUT | `/schools/:schoolId/reactivate` | `{ "reason": "..." }` |

**Deactivating really locks the school out.** Nobody in it can sign in, and
people who are already signed in are refused on their next request. Because the
check is cached for 30 seconds, the lockout reaches every server within about
30 seconds (immediately on the server that handled the request). Data is kept.

---

## 4. Switch an account off and on

`PUT /users/:userId/access`

```json
{ "action": "deactivate", "reason": "Left the school at the end of term" }
```

`action` is `activate`, `deactivate`, `change_role` (with `newRole`) or
`transfer_school` (with `schoolTransfer.targetSchoolId`). Deactivating stamps who
did it and why, ends the person's sessions, and blocks them at login even if
they were still on a temporary password.

A parent can never be made an admin. An account that was **removed** (section 6)
cannot be changed.

---

## 5. Remove a school (archive or delete — nothing is ever erased)

There is **no physical delete anywhere**. "Deleted" is a flag (`isDeleted = true`)
on the row, so everything can be restored and the history stays intact.

| Action | Endpoint | Effect |
|--------|----------|--------|
| Archive | `POST /schools/:schoolId/archive` | Locks everyone out, school stays in the normal list under `status=archived` |
| Delete | `DELETE /schools/:schoolId` | Sets `isDeleted`, locks everyone out, hides the school from lists (`status=deleted` or `all` shows it) |
| Restore | `POST /schools/:schoolId/restore` | Clears archive **and** deleted flags and reactivates the school |

Archive and delete both take:

```json
{ "reason": "Contract ended in July", "confirmSchoolName": "Greenfield Academy" }
```

`confirmSchoolName` must match the school's name (case and surrounding spaces are
ignored). Restore takes only `{ "reason": "..." }`.

Errors: `SCHOOL_ALREADY_ARCHIVED`, `SCHOOL_ALREADY_DELETED`, `SCHOOL_NOT_ARCHIVED`
(restore of a school that is neither archived nor deleted), `CONFIRMATION_MISMATCH`.

## 6. Remove a person

Sets `isDeleted` on the person, closes the account and **erases personal details**, but keeps the records
(grades, attendance, fee history) so they still add up.

| Method | Path | Body |
|--------|------|------|
| DELETE | `/schools/:schoolId/users/:userId` | `{ "reason": "..." }` |
| DELETE | `/schools/:schoolId/students/:studentId` | `{ "reason": "..." }` |

What is wiped: names (become "Removed User" / "Removed Student"), email,
phone, address, date of birth, photo, guardian, notes, emergency contacts,
pending invitations and one-time codes; the password becomes unusable; the
student's name is also removed from their fee invoices and receipts. Removing a
user also removes a linked student profile, and removing a student also closes
their login. The person is logged out everywhere.

Refused for the school's **primary admin** (archive the school or hand over
administration first) and for anyone already removed.

**Not wiped:** copies in free text elsewhere — for example the payer name a
bank reports on a fee payment, and report-card snapshots. These need a manual
review if a full erasure request requires them.

---

## 7. Import students and staff from CSV

Download a template: `GET /import/templates/students` or `/import/templates/staff`.

Upload with `multipart/form-data`, field name **`file`** (`.csv`, up to 5 MB and
5,000 rows):

```
POST /schools/:schoolId/import/students
POST /schools/:schoolId/import/staff
```

Add `?dryRun=true` to run every check **without writing anything**. Do a dry
run first, fix the file, then run it for real.

Imports create **records only**: no logins and no emails.

### How rows are handled

A bad row is skipped and reported (with its line number and column); good rows
are still imported. The response says what happened:

```json
{
  "dryRun": false,
  "summary": { "totalRows": 120, "valid": 117, "invalid": 3, "imported": 117 },
  "errors": [{ "line": 14, "field": "className", "message": "No active class named \"JSS9\" in this school" }],
  "warnings": [],
  "ignoredColumns": ["Notes"]
}
```

If someone else adds a clashing record while the import runs, nothing is
imported and you get `IMPORT_CONFLICT` — run it again.

Column names are matched loosely (`First Name`, `first_name` and `firstName` are
the same). Unknown columns are ignored and listed. Cells starting with `=` or
`@` are rejected (they would run as formulas in a spreadsheet).

### Students

| Column | Notes |
|--------|-------|
| `firstName`, `lastName` | required |
| `studentId` | admission number; must be unique in the school |
| `email` | unique among the school's active students |
| `className`, `armName` | must already exist in the school; an arm needs its class |
| `rollNumber` | unique within the class and arm |
| `gender` | male / female / other (`M`, `F` accepted) |
| `dateOfBirth` | `YYYY-MM-DD` or day-first `DD/MM/YYYY`; not in the future |
| `phone`, `address` | |
| `guardianName`, `guardianRelationship`, `guardianPhone`, `guardianEmail` | `guardianName` is required if any guardian detail is given |

The class name is also stored as the student's `grade` and `currentClass`,
because fee invoices and the student dashboard display those.

### Staff

| Column | Notes |
|--------|-------|
| `firstName`, `lastName`, `email` | required; the email must not exist in the school (any role) |
| `phone` | |
| `subjects` | separated with `;` or `\|`, up to 15. Names matching the school's subjects use the school's spelling; unknown ones import with a warning |
| `role` | only `teacher` is accepted. **Admins are never created from a spreadsheet.** |

### Inviting imported teachers

An imported teacher is a record with no login, shown as `not_invited` in the
staff list. Inviting them — from the school admin's dashboard, or in bulk:

`POST /schools/:schoolId/staff/invite` with `{}` (everyone waiting) or
`{ "userIds": ["..."] }` (at most 100)

— **claims the imported record**: it sets a temporary password and emails the
teacher, with no second user created. The response lists who was invited or
failed; temporary passwords are only ever emailed, never returned. At most 100
invitations go out per call (each sends an email); call again for the rest, the
response includes `remainingNotInvited`.

---

## 8. Database change

Adds to `schools`: `archivedAt`, `archivedBy`, `archiveReason`, `isDeleted`
(default `false`), `deletedAt`, `deletedBy`, `deleteReason`; and `isDeleted`
(default `false`) to `users` and `students`. All additive, no data touched. See
`docs/database-apply.md` for how to apply it.

## 9. Things to know

- The lockout cache is per server process (30 seconds). It cannot be shorter than
  that without a database query on every request.
- Access tokens are not revoked individually; they simply stop working because
  the account/school check fails.
