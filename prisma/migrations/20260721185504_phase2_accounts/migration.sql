/*
  Warnings:

  - You are about to drop the column `requesterSessionId` on the `Request` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "channelName" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queuePosition" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("channelName", "createdAt", "durationSeconds", "eventId", "id", "queuePosition", "requesterName", "status", "thumbnailUrl", "title", "updatedAt", "youtubeVideoId") SELECT "channelName", "createdAt", "durationSeconds", "eventId", "id", "queuePosition", "requesterName", "status", "thumbnailUrl", "title", "updatedAt", "youtubeVideoId" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_eventId_status_idx" ON "Request"("eventId", "status");
CREATE INDEX "Request_userId_idx" ON "Request"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
