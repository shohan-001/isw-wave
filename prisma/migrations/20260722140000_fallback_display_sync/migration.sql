-- Sync admin fallback playback to the public display.
ALTER TABLE "Event" ADD COLUMN "currentFallbackId" TEXT NOT NULL DEFAULT '';
