import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { utcDayKey } from "@/lib/song-play-stats";
import { logActivity } from "@/lib/activity-log";
import { getEventQuotaUsage } from "@/lib/youtube-quota";

export const dynamic = "force-dynamic";

// GET /api/owner/events/[eventId]
export async function GET(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  if (!(await requireStaff())) {
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

  const [pending, queue, dayPlays, youtubeQuota] = await Promise.all([
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
    getEventQuotaUsage(eventId, event.youtubeDailyQuotaCap),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      accessCode: event.accessCode,
      admin: event.admin,
      suspended: event.suspended,
      suspendedAt: event.suspendedAt?.toISOString() ?? null,
      suspendReason: event.suspendReason,
      youtubeDailyQuotaCap: event.youtubeDailyQuotaCap,
      youtubeQuota,
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

// PATCH /api/owner/events/[eventId]
//   { action: "suspend", reason? }
//   { action: "unsuspend" }
//   { action: "quota_cap", youtubeDailyQuotaCap: number }
export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      id: true,
      name: true,
      suspended: true,
      youtubeDailyQuotaCap: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
    youtubeDailyQuotaCap?: number;
  };

  if (body.action === "suspend") {
    const reason = (body.reason || "").trim().slice(0, 200);
    await prisma.event.update({
      where: { id: event.id },
      data: {
        suspended: true,
        suspendedAt: new Date(),
        suspendReason: reason,
      },
    });
    await logActivity({
      type: "event.suspended",
      actorType: "staff",
      actorId: staff.id,
      actorLabel: staff.username,
      eventId: event.id,
      targetType: "event",
      targetId: event.id,
      details: reason
        ? `suspended "${event.name}": ${reason}`
        : `suspended "${event.name}"`,
    });
    return NextResponse.json({ ok: true, suspended: true });
  }

  if (body.action === "unsuspend") {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        suspended: false,
        suspendedAt: null,
        suspendReason: "",
      },
    });
    await logActivity({
      type: "event.unsuspended",
      actorType: "staff",
      actorId: staff.id,
      actorLabel: staff.username,
      eventId: event.id,
      targetType: "event",
      targetId: event.id,
      details: `unsuspended "${event.name}"`,
    });
    return NextResponse.json({ ok: true, suspended: false });
  }

  if (body.action === "quota_cap") {
    const raw = Number(body.youtubeDailyQuotaCap);
    if (!Number.isFinite(raw)) {
      return NextResponse.json(
        { error: "youtubeDailyQuotaCap must be a number (0 = unlimited)." },
        { status: 400 }
      );
    }
    // Cap at the platform daily pool so a typo can't invent a fake budget.
    const cap = Math.max(0, Math.min(10_000, Math.floor(raw)));
    await prisma.event.update({
      where: { id: event.id },
      data: { youtubeDailyQuotaCap: cap },
    });
    await logActivity({
      type: "event.quota_cap_updated",
      actorType: "staff",
      actorId: staff.id,
      actorLabel: staff.username,
      eventId: event.id,
      targetType: "event",
      targetId: event.id,
      details: `"${event.name}" YouTube daily cap ${
        event.youtubeDailyQuotaCap || "unlimited"
      } → ${cap || "unlimited"}`,
    });
    return NextResponse.json({ ok: true, youtubeDailyQuotaCap: cap });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
