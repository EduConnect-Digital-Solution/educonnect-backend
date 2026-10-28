-- NexaPay gateway integration.
--
-- This repository has no baseline migration history (the schema is applied with
-- `prisma db push`), so this file is an INCREMENTAL DDL script, not a
-- `prisma migrate deploy` entry. Apply it with:
--
--   npx prisma db execute --file prisma/migrations/20261021120000_add_nexapay_gateway/migration.sql --schema prisma/schema.prisma
--
-- or simply run `npx prisma db push` against a development database.
-- NEVER run it against production without a reviewed backup and a maintenance window.

-- DropForeignKey
ALTER TABLE "fee_payments" DROP CONSTRAINT "fee_payments_receivedBy_fkey";

-- AlterTable
ALTER TABLE "fee_payments" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payerDetails" JSONB,
ADD COLUMN     "providerRaw" JSONB,
ADD COLUMN     "providerTxnId" TEXT,
ADD COLUMN     "reviewReason" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL,
ALTER COLUMN "receivedBy" DROP NOT NULL;

-- CreateTable
CREATE TABLE "nexapay_configs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "apiKeyEnc" TEXT NOT NULL,
    "webhookSecretEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexapay_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nexapay_configs_schoolId_key" ON "nexapay_configs"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "nexapay_configs_businessId_key" ON "nexapay_configs"("businessId");

-- CreateIndex
CREATE INDEX "nexapay_configs_schoolId_idx" ON "nexapay_configs"("schoolId");

-- CreateIndex
CREATE INDEX "gateway_events_schoolId_idx" ON "gateway_events"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_events_provider_eventId_key" ON "gateway_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "fee_payments_needsReview_idx" ON "fee_payments"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_gateway_providerTxnId_key" ON "fee_payments"("gateway", "providerTxnId");

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexapay_configs" ADD CONSTRAINT "nexapay_configs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_events" ADD CONSTRAINT "gateway_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

