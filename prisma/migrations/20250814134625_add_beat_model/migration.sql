-- CreateTable
CREATE TABLE "public"."Beat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL DEFAULT 120,
    "steps" INTEGER NOT NULL DEFAULT 16,
    "pattern" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Beat_userId_idx" ON "public"."Beat"("userId");
