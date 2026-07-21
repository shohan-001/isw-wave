import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EVENT_ID, STATUS } from "@/lib/constants";
import { getEvent, toPublicRequest } from "@/lib/queries";
import type { QueuePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/queue  (public)
// Now Playing + the upcoming approved queue in play order. The Display page and
// the admin dashboard both poll this every 5s (Phase 3 swaps polling for
// WebSockets — no change needed to this endpoint's shape).
export async function GET() {
  const event = await getEvent();

  const nowPlaying = event.currentRequestId
    ? await prisma.request.findUnique({ where: { id: event.currentRequestId } })
    : null;

  const queue = await prisma.request.findMany({
    where: {
      eventId: EVENT_ID,
      status: STATUS.APPROVED,
      // Exclude the currently-playing song from the "upcoming" list.
      id: event.currentRequestId ? { not: event.currentRequestId } : undefined,
    },
    orderBy: { queuePosition: "asc" },
  });

  const payload: QueuePayload = {
    eventName: event.name,
    nowPlaying: nowPlaying ? toPublicRequest(nowPlaying) : null,
    queue: queue.map(toPublicRequest),
  };
  return NextResponse.json(payload);
}
