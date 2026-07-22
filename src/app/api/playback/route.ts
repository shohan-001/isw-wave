import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notifyQueue } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// POST /api/playback — admin syncs hall display track + YouTube timeline.
// { fallbackId?: string | null }
// { positionSec?: number, playing?: boolean } — silent timeline tick (no Pusher spam)
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin?.eventId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    fallbackId?: string | null;
    positionSec?: number;
    playing?: boolean;
    resetTimeline?: boolean;
  };

  const hasFallback = "fallbackId" in body;
  const hasTimeline =
    typeof body.positionSec === "number" || typeof body.playing === "boolean";

  if (!hasFallback && !hasTimeline && !body.resetTimeline) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const data: {
    currentFallbackId?: string;
    currentRequestId?: string | null;
    playbackPositionSec?: number;
    playbackPlaying?: boolean;
    playbackUpdatedAt?: Date;
  } = {};

  if (hasFallback) {
    const fallbackId =
      body.fallbackId === null || body.fallbackId === undefined
        ? ""
        : String(body.fallbackId).trim();

    if (fallbackId) {
      const track = await prisma.fallbackTrack.findFirst({
        where: { id: fallbackId, eventId: admin.eventId },
        select: { id: true },
      });
      if (!track) {
        return NextResponse.json(
          { error: "Fallback track not found." },
          { status: 404 }
        );
      }
      data.currentFallbackId = fallbackId;
      data.currentRequestId = null;
      data.playbackPositionSec = 0;
      data.playbackPlaying = true;
      data.playbackUpdatedAt = new Date();
    } else {
      data.currentFallbackId = "";
    }
  }

  if (body.resetTimeline) {
    data.playbackPositionSec = 0;
    data.playbackPlaying = true;
    data.playbackUpdatedAt = new Date();
  }

  if (typeof body.positionSec === "number" && Number.isFinite(body.positionSec)) {
    data.playbackPositionSec = Math.max(0, body.positionSec);
    data.playbackUpdatedAt = new Date();
  }
  if (typeof body.playing === "boolean") {
    data.playbackPlaying = body.playing;
    data.playbackUpdatedAt = new Date();
  }

  await prisma.event.update({
    where: { id: admin.eventId },
    data,
  });

  // Only broadcast when the now-playing *track* changes — not every tick.
  if (hasFallback || body.resetTimeline) {
    await notifyQueue(admin.eventId);
  }

  return NextResponse.json({ ok: true });
}
