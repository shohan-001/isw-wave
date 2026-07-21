import "server-only";
import { prisma } from "./db";
import { EVENT_ID, STATUS } from "./constants";
import type { PublicRequest } from "./types";

// Ensure the single Phase-1 event exists (idempotent). The seed creates it, but
// this makes API routes resilient if the app runs against a fresh DB.
export async function getEvent() {
  let event = await prisma.event.findUnique({ where: { id: EVENT_ID } });
  if (!event) {
    event = await prisma.event.create({
      data: { id: EVENT_ID, name: "ISW Wave — Live Requests" },
    });
  }
  return event;
}

export function toPublicRequest(r: {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
  requesterName: string;
  status: string;
  queuePosition: number | null;
  createdAt: Date;
}): PublicRequest {
  return {
    id: r.id,
    youtubeVideoId: r.youtubeVideoId,
    title: r.title,
    thumbnailUrl: r.thumbnailUrl,
    durationSeconds: r.durationSeconds,
    channelName: r.channelName,
    requesterName: r.requesterName,
    status: r.status as PublicRequest["status"],
    queuePosition: r.queuePosition,
    createdAt: r.createdAt.toISOString(),
  };
}

// Count a user's "active" requests (pending or approved/queued) — used to
// enforce the per-user request limit server-side. Phase 2: keyed by userId
// (durable) instead of the Phase-1 anonymous session id.
export async function countActiveRequests(userId: string): Promise<number> {
  return prisma.request.count({
    where: {
      eventId: EVENT_ID,
      userId,
      status: { in: [STATUS.PENDING, STATUS.APPROVED] },
    },
  });
}

// Next queue position = (max existing position) + 1, so approved songs append
// to the end of the play order.
export async function nextQueuePosition(): Promise<number> {
  const last = await prisma.request.findFirst({
    where: { eventId: EVENT_ID, status: STATUS.APPROVED },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  });
  return (last?.queuePosition ?? 0) + 1;
}

// The approved queue in play order.
export async function getQueue() {
  return prisma.request.findMany({
    where: { eventId: EVENT_ID, status: STATUS.APPROVED },
    orderBy: { queuePosition: "asc" },
  });
}
