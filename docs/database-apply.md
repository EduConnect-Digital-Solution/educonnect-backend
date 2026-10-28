# Applying the database changes

This repo has no baseline migration history; the schema is applied with
`prisma db push`. The two features add **only new columns, tables and indexes**
(nothing is dropped from data you keep), but one NexaPay statement drops a
foreign key, so review before running.

| Order | Feature | File | Branch |
|-------|---------|------|--------|
| 1 | NexaPay gateway | `prisma/migrations/20261021120000_add_nexapay_gateway/migration.sql` | `feature/nexapay-integration` |
| 2 | Super-admin archive / soft delete | `prisma/migrations/20261028120000_add_school_archive/migration.sql` | `feature/superadmin-god-mode` |

The super-admin migration adds to `schools`: `archivedAt`, `archivedBy`,
`archiveReason`, `isDeleted` (default false), `deletedAt`, `deletedBy`,
`deleteReason`; to `users` and `students`: `isDeleted` (default false); plus two
indexes on `schools`. Existing rows get `isDeleted = false`.

## Development / staging

1. Merge both branches (or check out the merged branch).
2. `npx prisma db push` — applies the whole `schema.prisma` in one go, **or**
   run each SQL file in order:
   `npx prisma db execute --file <file> --schema prisma/schema.prisma`
3. `npx prisma generate`
4. Restart the server.

## Production

1. Take a backup/snapshot first.
2. Schedule a short maintenance window (NexaPay drops and re-adds a foreign key).
3. Run the two SQL files in the order above, then deploy the code. Deploying
   code before the columns exist makes login fail (it reads `isDeleted`).
4. Roll back by restoring the backup; the columns are additive, so leaving them
   in place is harmless if the code is rolled back instead.

I have not run either script against any database.
