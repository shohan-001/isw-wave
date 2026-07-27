import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { pruneOldSongPlayStats, utcDayKey } from "@/lib/song-play-stats";
import {
  getEventQuotaUsageMap,
  getQuotaUsage,
} from "@/lib/youtube-quota";

export const dynamic = "force-dynamic";

// GET /api/owner/overview — dashboard stats + live events board
export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
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

  const quotaByEvent = await getEventQuotaUsageMap(events.map((e) => e.id));

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

      const unitsUsed = quotaByEvent.get(ev.id) ?? 0;
      const cap = ev.youtubeDailyQuotaCap;

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
        suspended: ev.suspended,
        suspendReason: ev.suspendReason,
        youtubeDailyQuotaCap: cap,
        youtubeUnitsUsedToday: unitsUsed,
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

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const [quota, loginsToday, guestsToday, liveNow, staffCount, pendingRequests] =
    await Promise.all([
      getQuotaUsage(),
      prisma.activityLog.count({
        where: { type: "staff.login", createdAt: { gte: since } },
      }),
      prisma.participant.count({ where: { createdAt: { gte: since } } }),
      prisma.event.count({ where: { playbackPlaying: true } }),
      prisma.user.count({ where: { staffRole: { in: ["owner", "moderator"] } } }),
      prisma.eventRequest.count({ where: { status: "pending" } }),
    ]);

  return NextResponse.json({
    dayKey,
    viewer: staff,
    stats: {
      pendingRequests,
      liveNow,
      totalEvents: summaries.length,
      totalOrganizers: organizers.length,
      guestsToday,
      loginsToday,
      staffCount,
      quotaUnitsUsed: quota.unitsUsed,
      quotaLimit: quota.limit,
      quotaPercentUsed: quota.percentUsed,
    },
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
