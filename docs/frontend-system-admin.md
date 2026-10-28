# System Admin — frontend integration guide

Base URL: `{API}/api/system-admin`. All calls need
`Authorization: Bearer <system admin token>` from `POST /auth/login`.
Full endpoint notes and behaviour: `superadmin-god-mode.md`. Import the Postman
collection `postman/EduConnect-SystemAdmin.postman_collection.json` to try them.

**Conventions**

- Success: `{ "success": true, "message": "...", "data": ... }`.
- Failure: `{ "success": false, "message": "...", "code": "..." }`; validation
  errors (400) add `errors: [{ field, message }]`.
- School IDs in URLs are the code (`ABC1234`). User/student IDs are UUIDs.
- **No physical deletes.** "Delete" sets `isDeleted`; deleted schools are
  hidden from lists unless `status=deleted|all`, and can be restored.
- `reason` is required (10–500 chars) on every destructive action.

## Screens → endpoints

| Screen / action | Call |
|-----------------|------|
| Schools list (tabs: active, inactive, archived, deleted) | `GET /schools/management?status=&search=&tier=&page=&limit=` |
| School detail page | `GET /schools/:id` |
| Students tab / Staff tab | `GET /schools/:id/students`, `GET /schools/:id/staff?status=not_invited` |
| Add school | `POST /schools` → show `data.temporaryPassword` once if present |
| Switch school off/on | `PUT /schools/:id/deactivate` / `reactivate` `{reason}` |
| Archive school | `POST /schools/:id/archive` `{reason, confirmSchoolName}` |
| Delete school | `DELETE /schools/:id` `{reason, confirmSchoolName}` |
| Restore archived/deleted school | `POST /schools/:id/restore` `{reason}` |
| Deactivate/activate user | `PUT /users/:userId/access` `{action, reason}` |
| Remove user / student | `DELETE /schools/:id/users/:userId`, `.../students/:studentId` `{reason}` |
| CSV templates | `GET /schools/:id/import/students/template`, `.../staff/template` (downloads CSV) |
| Import | `POST /schools/:id/import/students|staff?dryRun=true` multipart, field `file` (≤5 MB, ≤5000 rows) |
| Invite imported teachers | `POST /schools/:id/staff/invite` `{userIds?: uuid[]}` (max 100 per call) |
| Audit log | `GET /audit-logs?schoolId=&action=&actor=&page=&limit=` |

## UX notes

- **Confirm dialogs**: archive and delete need the user to type the school name;
  send it as `confirmSchoolName`. Show a 400 `CONFIRMATION_MISMATCH` inline.
- **Imports**: always run `dryRun=true` first, show per-row errors, then re-submit
  without it. The import is partial: valid rows are saved, bad rows are returned.
- **Staff status badges**: `not_invited` (imported record), `invited`, `active`,
  `inactive`. Offer "Invite" only for `not_invited`.
- **Lockout** takes up to ~30 s to reach all servers after deactivate/archive/delete.

## Error codes to handle

`SCHOOL_NOT_FOUND` 404, `USER_NOT_FOUND`, `STUDENT_NOT_FOUND`,
`CONFIRMATION_MISMATCH` 400, `SCHOOL_ALREADY_ARCHIVED` / `SCHOOL_ALREADY_DELETED`
/ `SCHOOL_NOT_ARCHIVED` / `ALREADY_REMOVED` / `PRIMARY_ADMIN` 409,
`ACCESS_CHECK_FAILED` 503 (retry).

# NexaPay

The frontend reference for fee payments is
`docs/postman/NexaPay-Integration-API.md` on branch `feature/nexapay-integration`
(school config `PUT /api/fees/gateway/nexapay/config`, open a collection
`POST /api/fees/invoices/:id/initialize`, parent/student self-service payment,
webhook is server-to-server only). Postman: `postman/EduConnect-NexaPay.*`.
