-- Phase 5: Organization + event slug + YouTube cache/quota.
-- Backfills organizationId + slug from existing Event rows (no data loss).

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

INSERT INTO "Organization" ("id", "name", "ownerId", "createdAt", "updatedAt")
SELECT
  'org-' || "adminId",
  'My events',
  "adminId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "adminId" FROM "Event");

CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "requestLimit" INTEGER NOT NULL DEFAULT 3,
    "approvalMode" TEXT NOT NULL DEFAULT 'manual',
    "maxSongSeconds" INTEGER NOT NULL DEFAULT 480,
    "blockedKeywords" TEXT NOT NULL DEFAULT '',
    "autoModMode" TEXT NOT NULL DEFAULT 'reject',
    "accentColor" TEXT NOT NULL DEFAULT '#e0338f',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "displayMode" TEXT NOT NULL DEFAULT 'full',
    "currentRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_currentRequestId_fkey" FOREIGN KEY ("currentRequestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Event" (
  "id", "name", "slug", "accessCode", "organizationId", "adminId",
  "requestLimit", "approvalMode", "maxSongSeconds", "blockedKeywords", "autoModMode",
  "accentColor", "logoUrl", "displayMode",
  "currentRequestId", "createdAt", "updatedAt"
)
SELECT
  "id",
  "name",
  CASE
    WHEN "id" = 'isw-wave-main-event' THEN 'isw-wave-main'
    ELSE 'legacy-' || substr("id", 1, 12)
  END,
  "accessCode",
  'org-' || "adminId",
  "adminId",
  "requestLimit", "approvalMode", "maxSongSeconds", "blockedKeywords", "autoModMode",
  "accentColor", "logoUrl", "displayMode",
  "currentRequestId", "createdAt", "updatedAt"
FROM "Event";

DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId");
CREATE INDEX "Event_adminId_idx" ON "Event"("adminId");
CREATE INDEX "Event_organizationId_idx" ON "Event"("organizationId");

CREATE TABLE "SearchCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryKey" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SearchCache_queryKey_key" ON "SearchCache"("queryKey");
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");

CREATE TABLE "YouTubeQuotaDay" (
    "dayKey" TEXT NOT NULL PRIMARY KEY,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
