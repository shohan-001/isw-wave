-- Staff ops phase 2: request-to-host flow + one-time password setup links.

CREATE TABLE "EventRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicToken" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "orgName" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDetails" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "expectedGuests" INTEGER NOT NULL DEFAULT 0,
    "startsAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "createdUserId" TEXT NOT NULL DEFAULT '',
    "createdEventId" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "EventRequest_publicToken_key" ON "EventRequest"("publicToken");
CREATE INDEX "EventRequest_status_createdAt_idx" ON "EventRequest"("status", "createdAt");
CREATE INDEX "EventRequest_contactEmail_idx" ON "EventRequest"("contactEmail");

CREATE TABLE "PasswordSetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");
CREATE INDEX "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");
