-- Phase 3: votes, auto-moderation settings, fallback playlist

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Event: add moderation columns via table rebuild (SQLite).
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
    "currentRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_currentRequestId_fkey" FOREIGN KEY ("currentRequestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Event" (
  "id", "name", "accessCode", "adminId", "requestLimit", "approvalMode",
  "currentRequestId", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "accessCode", "adminId", "requestLimit", "approvalMode",
  "currentRequestId", "createdAt", "updatedAt"
FROM "Event";

DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId");
CREATE INDEX "Event_adminId_idx" ON "Event"("adminId");

-- Request: add vote/flag columns
CREATE TABLE "new_Request" (
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
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Request" (
  "id", "eventId", "youtubeVideoId", "title", "thumbnailUrl", "durationSeconds",
  "channelName", "participantId", "requesterName", "status", "queuePosition",
  "createdAt", "updatedAt"
)
SELECT
  "id", "eventId", "youtubeVideoId", "title", "thumbnailUrl", "durationSeconds",
  "channelName", "participantId", "requesterName", "status", "queuePosition",
  "createdAt", "updatedAt"
FROM "Request";

DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_eventId_status_idx" ON "Request"("eventId", "status");
CREATE INDEX "Request_participantId_idx" ON "Request"("participantId");
CREATE INDEX "Request_eventId_voteCount_idx" ON "Request"("eventId", "voteCount");

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Vote_requestId_participantId_key" ON "Vote"("requestId", "participantId");
CREATE INDEX "Vote_requestId_idx" ON "Vote"("requestId");

CREATE TABLE "FallbackTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "channelName" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FallbackTrack_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FallbackTrack_eventId_position_idx" ON "FallbackTrack"("eventId", "position");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
