import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import {
  getEventByAccessCode,
  getEventById,
  toPublicRequest,
} from "@/lib/queries";
import { getCurrentUser, normalizeAccessCode } from "@/lib/auth";
import type { QueuePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

 // GET /api/queue?code=XXXX | ?eventId=...
 // Public. Resolves the event from query params, or from the current session.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codeParam = searchParams.get("code");
  const eventIdParam = searchParams.get("eventId");

  let event =
    (codeParam
      ? await getEventByAccessCode(normalizeAccessCode(codeParam))
      : null) ||
    (eventIdParam ? await getEventById(eventIdParam) : null);

  if (!event) {
    const session = await getCurrentUser();
    if (session) event = await getEventById(session.eventId);
  }

  if (!event) {
    return NextResponse.json(
      { error: "Event not found. Pass ?code= or open display from the control room." },
      { status: 404 }
    );
  }

  const nowPlaying = event.currentRequestId
    ? await prisma.request.findUnique({ where: { id: event.currentRequestId } })
    : null;

  const queue = await prisma.request.findMany({
    where: {
      eventId: event.id,
      status: STATUS.APPROVED,
      id: event.currentRequestId ? { not: event.currentRequestId } : undefined,
    },
    orderBy: { queuePosition: "asc" },
  });

  const payload: QueuePayload = {
    eventId: event.id,
    eventName: event.name,
    accessCode: event.accessCode,
    nowPlaying: nowPlaying ? toPublicRequest(nowPlaying) : null,
    queue: queue.map(toPublicRequest),
  };
  return NextResponse.json(payload);
}
