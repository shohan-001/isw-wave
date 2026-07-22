import "server-only";
import { prisma } from "./db";
import { STATUS } from "./constants";
import type { PublicRequest } from "./types";

export async function getEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

export async function getEventByAccessCode(code: string) {
  return prisma.event.findUnique({ where: { accessCode: code } });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({ where: { slug } });
}

export async function requireEventById(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) throw new Error(`Event not found: ${eventId}`);
  return event;
}

export function toPublicRequest(
  r: {
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
    voteCount?: number;
    flagged?: boolean;
    flagReason?: string;
  },
  extras?: { iVoted?: boolean }
): PublicRequest {
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
    voteCount: r.voteCount ?? 0,
    flagged: r.flagged ?? false,
    flagReason: r.flagReason ?? "",
    iVoted: extras?.iVoted,
  };
}

export async function countActiveRequests(
  eventId: string,
  participantId: string
): Promise<number> {
  return prisma.request.count({
    where: {
      eventId,
      participantId,
      status: { in: [STATUS.PENDING, STATUS.APPROVED] },
    },
  });
}

export async function nextQueuePosition(eventId: string): Promise<number> {
  const last = await prisma.request.findFirst({
    where: { eventId, status: STATUS.APPROVED },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  });
  return (last?.queuePosition ?? 0) + 1;
}

export async function getQueue(eventId: string) {
  return prisma.request.findMany({
    where: { eventId, status: STATUS.APPROVED },
    orderBy: { queuePosition: "asc" },
  });
}
