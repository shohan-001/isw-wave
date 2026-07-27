-- AlterTable
ALTER TABLE "Event" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "suspendedAt" DATETIME;
ALTER TABLE "Event" ADD COLUMN "suspendReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Event" ADD COLUMN "youtubeDailyQuotaCap" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Event_suspended_idx" ON "Event"("suspended");

-- CreateTable
CREATE TABLE "EventYouTubeQuotaDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventYouTubeQuotaDay_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventYouTubeQuotaDay_dayKey_eventId_key" ON "EventYouTubeQuotaDay"("dayKey", "eventId");

-- CreateIndex
CREATE INDEX "EventYouTubeQuotaDay_eventId_idx" ON "EventYouTubeQuotaDay"("eventId");

-- CreateIndex
CREATE INDEX "EventYouTubeQuotaDay_dayKey_idx" ON "EventYouTubeQuotaDay"("dayKey");
