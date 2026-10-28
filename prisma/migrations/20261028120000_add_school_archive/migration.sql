-- System admin: archive and soft-delete schools; soft-delete users and students.
--
-- Nothing is ever physically deleted. "Deleted" means isDeleted = true.
--
-- This repository has no baseline migration history (the schema is applied with
-- `prisma db push`), so this is an INCREMENTAL DDL script. Apply with:
--
--   npx prisma db execute --file prisma/migrations/20261028120000_add_school_archive/migration.sql --schema prisma/schema.prisma
--
-- or run `npx prisma db push` against a development database.
-- Every column is nullable or has a default, so existing rows are untouched.
-- Back up before running against production.

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "students" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "schools_archivedAt_idx" ON "schools"("archivedAt");
CREATE INDEX "schools_isDeleted_idx" ON "schools"("isDeleted");
