-- CreateTable
CREATE TABLE "public"."UserSound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BEAT',
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSound_userId_idx" ON "public"."UserSound"("userId");
