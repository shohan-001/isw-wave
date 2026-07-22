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

export const dynamic = "force-dynamic";

 // POST /api/requests — participant creates a song request for their event.
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

  const autoApprove = event.approvalMode === "auto";
  const created = await prisma.request.create({
    data: {
      eventId: event.id,
      youtubeVideoId: body.youtubeVideoId,
      title: body.title.slice(0, 200),
      thumbnailUrl: body.thumbnailUrl || "",
      durationSeconds: Math.max(0, Math.floor(body.durationSeconds || 0)),
      channelName: (body.channelName || "").slice(0, 100),
      participantId: session.id,
      requesterName: session.displayName,
      status: autoApprove ? STATUS.APPROVED : STATUS.PENDING,
      queuePosition: autoApprove ? await nextQueuePosition(event.id) : null,
    },
  });

  return NextResponse.json(
    {
      request: toPublicRequest(created),
      used: active + 1,
      limit: event.requestLimit,
    },
    { status: 201 }
  );
}

 // GET /api/requests?mine=1        -> participant's own requests + quota
 // GET /api/requests?status=...    -> admin: list by status for their event
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine");

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
      requests: rows.map(toPublicRequest),
      used: active,
      limit: event.requestLimit,
    });
  }

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = searchParams.get("status") || STATUS.PENDING;
  const rows = await prisma.request.findMany({
    where: { eventId: admin.eventId, status },
    orderBy:
      status === STATUS.APPROVED
        ? { queuePosition: "asc" }
        : { createdAt: "asc" },
  });
  return NextResponse.json({ requests: rows.map(toPublicRequest) });
}
