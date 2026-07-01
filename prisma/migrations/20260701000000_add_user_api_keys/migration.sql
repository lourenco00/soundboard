-- AlterTable
ALTER TABLE "public"."User"
  ADD COLUMN "anthropicKeyEnc" TEXT,
  ADD COLUMN "anthropicKeyLast4" TEXT,
  ADD COLUMN "openaiKeyEnc" TEXT,
  ADD COLUMN "openaiKeyLast4" TEXT;
