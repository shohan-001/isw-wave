-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "requestLimit" INTEGER NOT NULL DEFAULT 3,
    "approvalMode" TEXT NOT NULL DEFAULT 'manual',
    "currentRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_currentRequestId_fkey" FOREIGN KEY ("currentRequestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "channelName" TEXT NOT NULL DEFAULT '',
    "requesterName" TEXT NOT NULL,
    "requesterSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queuePosition" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId");

-- CreateIndex
CREATE INDEX "Request_eventId_status_idx" ON "Request"("eventId", "status");

-- CreateIndex
CREATE INDEX "Request_requesterSessionId_idx" ON "Request"("requesterSessionId");
