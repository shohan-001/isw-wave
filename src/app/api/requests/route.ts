import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import {
  countActiveRequests,
  nextQueuePosition,
  toPublicRequest,
  requireEventById,
} from "@/lib/queries";
import { checkAutoModeration } from "@/lib/moderation";
import {
  notifyPending,
  notifyQueue,
  notifyRequests,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session || session.role !== "participant") {
    return NextResponse.json(
      { error: "Join the event with your name and code to request a song." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    youtubeVideoId?: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    channelName?: string;
  } | null;

  if (!body?.youtubeVideoId || !body.title) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const event = await requireEventById(session.eventId);
  const active = await countActiveRequests(event.id, session.id);
  if (active >= event.requestLimit) {
    return NextResponse.json(
      {
        error: `You already have ${active} active request${
          active === 1 ? "" : "s"
        } (limit ${event.requestLimit}). Wait for one to play or be handled.`,
        limitReached: true,
      },
      { status: 429 }
    );
  }

  const title = body.title.slice(0, 200);
  const durationSeconds = Math.max(0, Math.floor(body.durationSeconds || 0));
  const modHit = checkAutoModeration({
    title,
    durationSeconds,
    maxSongSeconds: event.maxSongSeconds,
    blockedKeywords: event.blockedKeywords,
  });

  if (modHit && event.autoModMode === "reject") {
    return NextResponse.json(
      { error: modHit.reason, moderated: true },
      { status: 422 }
    );
  }

  const autoApprove = event.approvalMode === "auto" && !modHit;
  const created = await prisma.request.create({
    data: {
      eventId: event.id,
      youtubeVideoId: body.youtubeVideoId,
      title,
      thumbnailUrl: body.thumbnailUrl || "",
      durationSeconds,
      channelName: (body.channelName || "").slice(0, 100),
      participantId: session.id,
      requesterName: session.displayName,
      status: autoApprove ? STATUS.APPROVED : STATUS.PENDING,
      queuePosition: autoApprove ? await nextQueuePosition(event.id) : null,
      flagged: Boolean(modHit),
      flagReason: modHit?.reason ?? "",
    },
  });

  await Promise.all([
    notifyPending(event.id),
    notifyRequests(event.id),
    autoApprove ? notifyQueue(event.id) : Promise.resolve(),
  ]);

  return NextResponse.json(
    {
      request: toPublicRequest(created),
      used: active + 1,
      limit: event.requestLimit,
      flagged: created.flagged,
      flagReason: created.flagReason || undefined,
    },
    { status: 201 }
  );
}

 // GET /api/requests?mine=1
 // GET /api/requests?crowd=1          -> public pending (participants) + votes
 // GET /api/requests?status=pending&sort=votes  -> admin
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine");
  const crowd = searchParams.get("crowd");

  if (mine) {
    const session = await getCurrentUser();
    if (!session || session.role !== "participant") {
      return NextResponse.json({ requests: [], used: 0, limit: 0 });
    }
    const [rows, event, active] = await Promise.all([
      prisma.request.findMany({
        where: { eventId: session.eventId, participantId: session.id },
        orderBy: { createdAt: "desc" },
      }),
      requireEventById(session.eventId),
      countActiveRequests(session.eventId, session.id),
    ]);
    return NextResponse.json({
      requests: rows.map((r) => toPublicRequest(r)),
      used: active,
      limit: event.requestLimit,
    });
  }

  if (crowd) {
    const session = await getCurrentUser();
    if (!session || session.role !== "participant") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const event = await prisma.event.findUnique({
      where: { id: session.eventId },
      select: { currentRequestId: true },
    });
    const rows = await prisma.request.findMany({
      where: {
        eventId: session.eventId,
        status: { in: [STATUS.PENDING, STATUS.APPROVED] },
        ...(event?.currentRequestId
          ? { id: { not: event.currentRequestId } }
          : {}),
      },
      orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
      include: {
        votes: {
          where: { participantId: session.id },
          select: { id: true },
        },
      },
    });
    return NextResponse.json({
      requests: rows.map((r) =>
        toPublicRequest(r, { iVoted: r.votes.length > 0 })
      ),
    });
  }

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = searchParams.get("status") || STATUS.PENDING;
  const sort = searchParams.get("sort") || "time";
  const rows = await prisma.request.findMany({
    where: { eventId: admin.eventId, status },
    orderBy:
      status === STATUS.APPROVED
        ? sort === "requester"
          ? { requesterName: "asc" }
          : sort === "time"
          ? { createdAt: "asc" }
          : { queuePosition: "asc" }
        : sort === "votes"
        ? [{ voteCount: "desc" }, { createdAt: "asc" }]
        : sort === "requester"
        ? [{ requesterName: "asc" }, { createdAt: "asc" }]
        : { createdAt: "asc" },
  });
  return NextResponse.json({ requests: rows.map((r) => toPublicRequest(r)) });
}
