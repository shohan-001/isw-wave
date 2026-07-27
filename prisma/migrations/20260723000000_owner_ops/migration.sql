-- Owner ops: guest bans + daily song play rollups (prune old days on write).

ALTER TABLE "Participant" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Participant" ADD COLUMN "bannedAt" DATETIME;
ALTER TABLE "Participant" ADD COLUMN "banReason" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SongPlayStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SongPlayStat_dayKey_eventId_youtubeVideoId_key" ON "SongPlayStat"("dayKey", "eventId", "youtubeVideoId");
CREATE INDEX "SongPlayStat_dayKey_playCount_idx" ON "SongPlayStat"("dayKey", "playCount");
CREATE INDEX "SongPlayStat_eventId_dayKey_idx" ON "SongPlayStat"("eventId", "dayKey");
