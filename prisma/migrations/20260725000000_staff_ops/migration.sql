-- Staff ops phase 1: named owner/moderator accounts + audit trail.
-- eventLimit defaults to 0 (unlimited) so existing organizers keep current behavior;
-- approvals set an explicit cap.

ALTER TABLE "User" ADD COLUMN "staffRole" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "disabledAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "eventLimit" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "User_staffRole_idx" ON "User"("staffRole");

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "actorId" TEXT NOT NULL DEFAULT '',
    "actorLabel" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL DEFAULT '',
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_type_createdAt_idx" ON "ActivityLog"("type", "createdAt");
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
