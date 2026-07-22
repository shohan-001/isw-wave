import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { pruneOldSongPlayStats, utcDayKey } from "@/lib/song-play-stats";

export const dynamic = "force-dynamic";

// GET /api/owner/overview — live events board
export async function GET() {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await pruneOldSongPlayStats();

  const events = await prisma.event.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      organization: { select: { name: true, ownerId: true } },
      admin: { select: { id: true, username: true, email: true } },
      current: {
        select: {
          id: true,
          title: true,
          youtubeVideoId: true,
          requesterName: true,
        },
      },
      _count: {
        select: {
          participants: true,
          requests: true,
        },
      },
    },
  });

  const summaries = await Promise.all(
    events.map(async (ev) => {
      const [pendingCount, queueDepth, bannedCount, activeGuests] =
        await Promise.all([
          prisma.request.count({
            where: { eventId: ev.id, status: STATUS.PENDING },
          }),
          prisma.request.count({
            where: {
              eventId: ev.id,
              status: STATUS.APPROVED,
              id: ev.currentRequestId ? { not: ev.currentRequestId } : undefined,
            },
          }),
          prisma.participant.count({
            where: { eventId: ev.id, banned: true },
          }),
          prisma.participant.count({
            where: { eventId: ev.id, banned: false },
          }),
        ]);

      return {
        id: ev.id,
        name: ev.name,
        slug: ev.slug,
        accessCode: ev.accessCode,
        organizationName: ev.organization.name,
        admin: ev.admin,
        participantCount: ev._count.participants,
        activeGuestCount: activeGuests,
        bannedCount,
        pendingCount,
        queueDepth,
        nowPlaying: ev.current
          ? {
              id: ev.current.id,
              title: ev.current.title,
              youtubeVideoId: ev.current.youtubeVideoId,
              requesterName: ev.current.requesterName,
            }
          : null,
        fallbackId: ev.currentFallbackId || null,
        playbackPlaying: ev.playbackPlaying,
        updatedAt: ev.updatedAt.toISOString(),
        createdAt: ev.createdAt.toISOString(),
      };
    })
  );

  const dayKey = utcDayKey();
  const topSongs = await prisma.songPlayStat.findMany({
    where: { dayKey },
    orderBy: { playCount: "desc" },
    take: 15,
  });

  const organizers = await prisma.user.findMany({
    where: { isAdmin: true },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    dayKey,
    events: summaries,
    topSongs: topSongs.map((s) => ({
      eventId: s.eventId,
      youtubeVideoId: s.youtubeVideoId,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      playCount: s.playCount,
    })),
    organizers: organizers.map((o) => ({
      id: o.id,
      username: o.username,
      email: o.email,
      eventCount: o._count.events,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
