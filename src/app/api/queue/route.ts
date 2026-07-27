import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import {
  getEventByAccessCode,
  getEventById,
  toPublicRequest,
} from "@/lib/queries";
import { getCurrentUser, normalizeAccessCode } from "@/lib/auth";
import type { QueuePayload, PublicRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function fallbackAsNowPlaying(track: {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
}): PublicRequest {
  return {
    id: track.id,
    youtubeVideoId: track.youtubeVideoId,
    title: track.title,
    thumbnailUrl: track.thumbnailUrl,
    durationSeconds: track.durationSeconds,
    channelName: track.channelName,
    requesterName: "Fallback",
    status: "approved",
    queuePosition: null,
    createdAt: new Date().toISOString(),
    voteCount: 0,
    flagged: false,
    flagReason: "",
  };
}

// GET /api/queue?code=XXXX | ?eventId=...
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

  let nowPlaying: PublicRequest | null = null;
  let nowPlayingIsFallback = false;

  if (event.currentRequestId) {
    const row = await prisma.request.findUnique({
      where: { id: event.currentRequestId },
    });
    if (row) nowPlaying = toPublicRequest(row);
  } else if (event.currentFallbackId) {
    const track = await prisma.fallbackTrack.findUnique({
      where: { id: event.currentFallbackId },
    });
    if (track && track.eventId === event.id) {
      nowPlaying = fallbackAsNowPlaying(track);
      nowPlayingIsFallback = true;
    }
  }

  const queue = await prisma.request.findMany({
    where: {
      eventId: event.id,
      status: STATUS.APPROVED,
      id: event.currentRequestId ? { not: event.currentRequestId } : undefined,
    },
    // Highest votes first; equal votes keep admin queue order.
    orderBy: [{ voteCount: "desc" }, { queuePosition: "asc" }, { createdAt: "asc" }],
  });

  const payload: QueuePayload = {
    eventId: event.id,
    eventName: event.name,
    accessCode: event.accessCode,
    accentColor: event.accentColor || "#e0338f",
    logoUrl: event.logoUrl || "",
    displayMode: event.displayMode === "minimal" ? "minimal" : "full",
    nowPlaying,
    nowPlayingIsFallback,
    playback: {
      positionSec: event.playbackPositionSec ?? 0,
      playing: Boolean(event.playbackPlaying),
      updatedAt: event.playbackUpdatedAt
        ? event.playbackUpdatedAt.toISOString()
        : null,
    },
    queue: queue.map((r) => toPublicRequest(r)),
  };
  return NextResponse.json(payload);
}
