-- Phase 4: per-event theming + display mode

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
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
    CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_currentRequestId_fkey" FOREIGN KEY ("currentRequestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Event" (
  "id", "name", "accessCode", "adminId", "requestLimit", "approvalMode",
  "maxSongSeconds", "blockedKeywords", "autoModMode",
  "currentRequestId", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "accessCode", "adminId", "requestLimit", "approvalMode",
  "maxSongSeconds", "blockedKeywords", "autoModMode",
  "currentRequestId", "createdAt", "updatedAt"
FROM "Event";

DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId");
CREATE INDEX "Event_adminId_idx" ON "Event"("adminId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
