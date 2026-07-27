import "server-only";
import { prisma } from "@/lib/db";

/** UTC calendar day key YYYY-MM-DD */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Drop play-stat rows from previous days (keep today only). */
export async function pruneOldSongPlayStats(today = utcDayKey()): Promise<void> {
  await prisma.songPlayStat.deleteMany({
    where: { dayKey: { lt: today } },
  });
}

/** Record that a request finished / was marked played. */
export async function recordSongPlay(input: {
  eventId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl?: string;
}): Promise<void> {
  const dayKey = utcDayKey();
  const videoId = input.youtubeVideoId.trim();
  if (!videoId) return;

  await pruneOldSongPlayStats(dayKey);

  await prisma.songPlayStat.upsert({
    where: {
      dayKey_eventId_youtubeVideoId: {
        dayKey,
        eventId: input.eventId,
        youtubeVideoId: videoId,
      },
    },
    create: {
      dayKey,
      eventId: input.eventId,
      youtubeVideoId: videoId,
      title: input.title.slice(0, 200),
      thumbnailUrl: (input.thumbnailUrl || "").slice(0, 500),
      playCount: 1,
    },
    update: {
      playCount: { increment: 1 },
      title: input.title.slice(0, 200),
      thumbnailUrl: (input.thumbnailUrl || "").slice(0, 500),
    },
  });
}
