-- AlterTable
ALTER TABLE "public"."Beat" ADD COLUMN "folder" TEXT;

-- CreateTable
CREATE TABLE "public"."PianoPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PianoPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PresetFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresetFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PianoPreset_userId_idx" ON "public"."PianoPreset"("userId");

-- CreateIndex
CREATE INDEX "PresetFolder_userId_idx" ON "public"."PresetFolder"("userId");
