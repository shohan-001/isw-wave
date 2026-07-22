-- Sync admin YouTube timeline to the public display.
ALTER TABLE "Event" ADD COLUMN "playbackPositionSec" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN "playbackPlaying" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "playbackUpdatedAt" DATETIME;
