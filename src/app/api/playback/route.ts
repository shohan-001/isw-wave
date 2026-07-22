import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notifyQueue } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// POST /api/playback — admin sets what the hall display should show.
// { fallbackId: string | null } — when looping fallback with an empty request queue.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin?.eventId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    fallbackId?: string | null;
  };

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
      return NextResponse.json({ error: "Fallback track not found." }, { status: 404 });
    }
  }

  await prisma.event.update({
    where: { id: admin.eventId },
    data: {
      currentFallbackId: fallbackId,
      // Live requests own the stage — clear request pointer only when entering fallback.
      ...(fallbackId ? { currentRequestId: null } : {}),
    },
  });

  await notifyQueue(admin.eventId);
  return NextResponse.json({ ok: true, fallbackId: fallbackId || null });
}
