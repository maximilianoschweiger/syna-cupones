-- Add extended visual validation fields to coupons table
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "hasDni" BOOLEAN;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "hasAclaracion" BOOLEAN;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "isPartialSignature" BOOLEAN;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "hasManualWriting" BOOLEAN;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "missingFields" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "ocrText" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "imageQualityScore" DOUBLE PRECISION;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "pageIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "isBatchClose" BOOLEAN NOT NULL DEFAULT false;

-- Index for batch close filtering
CREATE INDEX IF NOT EXISTS "coupons_isBatchClose_idx" ON "coupons"("isBatchClose");
