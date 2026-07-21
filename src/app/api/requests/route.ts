import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EVENT_ID, STATUS } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import {
  getEvent,
  countActiveRequests,
  nextQueuePosition,
  toPublicRequest,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// POST /api/requests
// Body: { youtubeVideoId, title, thumbnailUrl, durationSeconds, channelName,
//         requesterName }
// Creates a request for the current session. Enforces the per-user active
// limit (Event.requestLimit) server-side. If the event is in "auto" approval
// mode, the request is approved immediately and appended to the queue.
export async function POST(req: Request) {
  const sessionId = getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "No session. Reload the page and try again." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    youtubeVideoId?: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    channelName?: string;
    requesterName?: string;
  } | null;

  if (!body?.youtubeVideoId || !body.title) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const requesterName = (body.requesterName || "").trim().slice(0, 40);
  if (!requesterName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const event = await getEvent();

  // Enforce the configurable per-user active-request limit.
  const active = await countActiveRequests(sessionId);
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
      requesterName,
      requesterSessionId: sessionId,
      status: autoApprove ? STATUS.APPROVED : STATUS.PENDING,
      queuePosition: autoApprove ? await nextQueuePosition() : null,
    },
  });

  return NextResponse.json({ request: toPublicRequest(created) }, { status: 201 });
}

// GET /api/requests?status=pending    -> admin: list by status (default pending)
// GET /api/requests?mine=1            -> current session's own requests
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine");

  if (mine) {
    const sessionId = getSessionId();
    if (!sessionId) return NextResponse.json({ requests: [] });
    const rows = await prisma.request.findMany({
      where: { eventId: EVENT_ID, requesterSessionId: sessionId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ requests: rows.map(toPublicRequest) });
  }

  // Admin-only listing.
  if (!isAdmin()) {
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
