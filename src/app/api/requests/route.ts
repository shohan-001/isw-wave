import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EVENT_ID, STATUS } from "@/lib/constants";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import {
  getEvent,
  countActiveRequests,
  nextQueuePosition,
  toPublicRequest,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// POST /api/requests
// Body: { youtubeVideoId, title, thumbnailUrl, durationSeconds, channelName }
// Creates a request for the logged-in user. Enforces the per-user active limit
// (Event.requestLimit) server-side, keyed by userId so it survives cookie loss.
// The requester name is taken from the account (username), not the request body.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please log in to request a song." },
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

  const event = await getEvent();

  // Enforce the configurable per-user active-request limit (keyed by userId).
  const active = await countActiveRequests(user.id);
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
      eventId: EVENT_ID,
      youtubeVideoId: body.youtubeVideoId,
      title: body.title.slice(0, 200),
      thumbnailUrl: body.thumbnailUrl || "",
      durationSeconds: Math.max(0, Math.floor(body.durationSeconds || 0)),
      channelName: (body.channelName || "").slice(0, 100),
      userId: user.id,
      requesterName: user.username,
      status: autoApprove ? STATUS.APPROVED : STATUS.PENDING,
      queuePosition: autoApprove ? await nextQueuePosition() : null,
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

// GET /api/requests?mine=1        -> current user's own requests + quota
// GET /api/requests?status=...    -> admin: list by status (default pending)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine");

  if (mine) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ requests: [], used: 0, limit: 0 });
    }
    const [rows, event, active] = await Promise.all([
      prisma.request.findMany({
        where: { eventId: EVENT_ID, userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      getEvent(),
      countActiveRequests(user.id),
    ]);
    return NextResponse.json({
      requests: rows.map(toPublicRequest),
      used: active,
      limit: event.requestLimit,
    });
  }

  // Admin-only listing.
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = searchParams.get("status") || STATUS.PENDING;
  const rows = await prisma.request.findMany({
    where: { eventId: EVENT_ID, status },
    orderBy:
      status === STATUS.APPROVED
        ? { queuePosition: "asc" }
        : { createdAt: "asc" },
  });
  return NextResponse.json({ requests: rows.map(toPublicRequest) });
}
