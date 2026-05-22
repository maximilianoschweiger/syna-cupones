-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('SIGNED', 'UNSIGNED', 'DUBIOUS', 'PENDING');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'CLOSING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('UNSIGNED_THRESHOLD', 'NO_ATTACHMENT', 'DUBIOUS_COUPON', 'MISSING_CLOSING', 'IMAP_ERROR', 'AI_ERROR');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "subject" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "shift" "Shift" NOT NULL DEFAULT 'UNKNOWN',
    "rawDate" TEXT,
    "errorMessage" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "publicId" TEXT,
    "pageCount" INTEGER,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "emailId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "couponNumber" TEXT,
    "amount" DECIMAL(12,2),
    "installments" INTEGER,
    "cardType" TEXT,
    "authCode" TEXT,
    "merchant" TEXT,
    "couponDate" TIMESTAMP(3),
    "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "aiConfidence" DOUBLE PRECISION,
    "aiRawResponse" JSONB,
    "notes" TEXT,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "attachmentId" TEXT NOT NULL,
    "emailId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "branchCode" TEXT,
    "branchId" TEXT,
    "emailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "source" TEXT,
    "service" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "imapHost" TEXT NOT NULL DEFAULT '',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapUser" TEXT NOT NULL DEFAULT '',
    "imapPassword" TEXT NOT NULL DEFAULT '',
    "imapTls" BOOLEAN NOT NULL DEFAULT true,
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "openaiMaxTokens" INTEGER NOT NULL DEFAULT 1000,
    "cronSchedule" TEXT NOT NULL DEFAULT '*/15 * * * *',
    "unsignedThreshold" INTEGER NOT NULL DEFAULT 3,
    "alertNoAttachment" BOOLEAN NOT NULL DEFAULT true,
    "alertDubious" BOOLEAN NOT NULL DEFAULT true,
    "alertMissingClosing" BOOLEAN NOT NULL DEFAULT true,
    "alertEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_code_idx" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_branchId_idx" ON "emails"("branchId");

-- CreateIndex
CREATE INDEX "emails_receivedAt_idx" ON "emails"("receivedAt");

-- CreateIndex
CREATE INDEX "emails_processed_idx" ON "emails"("processed");

-- CreateIndex
CREATE INDEX "attachments_emailId_idx" ON "attachments"("emailId");

-- CreateIndex
CREATE INDEX "coupons_attachmentId_idx" ON "coupons"("attachmentId");

-- CreateIndex
CREATE INDEX "coupons_signatureStatus_idx" ON "coupons"("signatureStatus");

-- CreateIndex
CREATE INDEX "coupons_branchId_idx" ON "coupons"("branchId");

-- CreateIndex
CREATE INDEX "coupons_couponDate_idx" ON "coupons"("couponDate");

-- CreateIndex
CREATE INDEX "coupons_createdAt_idx" ON "coupons"("createdAt");

-- CreateIndex
CREATE INDEX "alerts_dismissed_idx" ON "alerts"("dismissed");

-- CreateIndex
CREATE INDEX "alerts_type_idx" ON "alerts"("type");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_logs_level_idx" ON "system_logs"("level");

-- CreateIndex
CREATE INDEX "system_logs_createdAt_idx" ON "system_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
