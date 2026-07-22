import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { pruneOldSongPlayStats, utcDayKey } from "@/lib/song-play-stats";

export const dynamic = "force-dynamic";

// GET /api/owner/top-songs?eventId=&day=
export async function GET(req: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId")?.trim() || undefined;
  const dayKey = searchParams.get("day")?.trim() || utcDayKey();

  await pruneOldSongPlayStats();

  const rows = await prisma.songPlayStat.findMany({
    where: {
      dayKey,
      ...(eventId ? { eventId } : {}),
    },
    orderBy: { playCount: "desc" },
    take: 50,
  });

  return NextResponse.json({
    dayKey,
    songs: rows.map((s) => ({
      eventId: s.eventId,
      youtubeVideoId: s.youtubeVideoId,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      playCount: s.playCount,
    })),
  });
}
