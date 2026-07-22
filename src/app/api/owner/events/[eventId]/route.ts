import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { utcDayKey } from "@/lib/song-play-stats";

export const dynamic = "force-dynamic";

// GET /api/owner/events/[eventId]
export async function GET(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = params.eventId;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      admin: { select: { id: true, username: true, email: true } },
      current: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const participants = await prisma.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      displayName: true,
      deviceId: true,
      banned: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      _count: { select: { requests: true, votes: true } },
    },
  });

  const [pending, queue, dayPlays] = await Promise.all([
    prisma.request.count({ where: { eventId, status: STATUS.PENDING } }),
    prisma.request.count({
      where: {
        eventId,
        status: STATUS.APPROVED,
        id: event.currentRequestId ? { not: event.currentRequestId } : undefined,
      },
    }),
    prisma.songPlayStat.findMany({
      where: { eventId, dayKey: utcDayKey() },
      orderBy: { playCount: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      accessCode: event.accessCode,
      admin: event.admin,
      nowPlaying: event.current
        ? {
            id: event.current.id,
            title: event.current.title,
            youtubeVideoId: event.current.youtubeVideoId,
            requesterName: event.current.requesterName,
          }
        : null,
      pending,
      queue,
    },
    participants: participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      deviceId: p.deviceId.slice(0, 8) + "…",
      banned: p.banned,
      bannedAt: p.bannedAt?.toISOString() ?? null,
      banReason: p.banReason,
      requestCount: p._count.requests,
      voteCount: p._count.votes,
      createdAt: p.createdAt.toISOString(),
    })),
    topSongs: dayPlays.map((s) => ({
      youtubeVideoId: s.youtubeVideoId,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      playCount: s.playCount,
    })),
  });
}
