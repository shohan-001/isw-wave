-- Phase 2 redesign: event access codes + Participant joins.
-- Wipes Event/Request (and old User-linked requests). Re-seed after migrate.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "Request";
DROP TABLE IF EXISTS "Participant";
DROP TABLE IF EXISTS "Event";

CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "requestLimit" INTEGER NOT NULL DEFAULT 3,
    "approvalMode" TEXT NOT NULL DEFAULT 'manual',
    "currentRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_currentRequestId_fkey" FOREIGN KEY ("currentRequestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId");
CREATE INDEX "Event_adminId_idx" ON "Event"("adminId");

CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Participant_eventId_deviceId_key" ON "Participant"("eventId", "deviceId");
CREATE INDEX "Participant_deviceId_idx" ON "Participant"("deviceId");
CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId");

CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "channelName" TEXT NOT NULL DEFAULT '',
    "participantId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queuePosition" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Request_eventId_status_idx" ON "Request"("eventId", "status");
CREATE INDEX "Request_participantId_idx" ON "Request"("participantId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
