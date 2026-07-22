import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { FallbackTrack } from "@/lib/types";
import { notifyFallback } from "@/lib/realtime";

export const dynamic = "force-dynamic";

function toTrack(t: {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
  position: number;
}): FallbackTrack {
  return {
    id: t.id,
    youtubeVideoId: t.youtubeVideoId,
    title: t.title,
    thumbnailUrl: t.thumbnailUrl,
    durationSeconds: t.durationSeconds,
    channelName: t.channelName,
    position: t.position,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tracks = await prisma.fallbackTrack.findMany({
    where: { eventId: admin.eventId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ tracks: tracks.map(toTrack) });
}

 // POST — add a track to the end of the fallback playlist
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    youtubeVideoId?: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    channelName?: string;
  } | null;

  if (!body?.youtubeVideoId || !body.title) {
    return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  }

  const last = await prisma.fallbackTrack.findFirst({
    where: { eventId: admin.eventId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  const track = await prisma.fallbackTrack.create({
    data: {
      eventId: admin.eventId,
      youtubeVideoId: body.youtubeVideoId,
      title: body.title.slice(0, 200),
      thumbnailUrl: body.thumbnailUrl || "",
      durationSeconds: Math.max(0, Math.floor(body.durationSeconds || 0)),
      channelName: (body.channelName || "").slice(0, 100),
      position,
    },
  });
  await notifyFallback(admin.eventId);
  return NextResponse.json({ track: toTrack(track) }, { status: 201 });
}

 // PATCH — reorder { id, direction: up|down } or bulk positions
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    direction?: "up" | "down";
  };
  if (!body.id || (body.direction !== "up" && body.direction !== "down")) {
    return NextResponse.json({ error: "Invalid reorder." }, { status: 400 });
  }

  const target = await prisma.fallbackTrack.findUnique({
    where: { id: body.id },
  });
  if (!target || target.eventId !== admin.eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const neighbor = await prisma.fallbackTrack.findFirst({
    where: {
      eventId: admin.eventId,
      position:
        body.direction === "up"
          ? { lt: target.position }
          : { gt: target.position },
    },
    orderBy: { position: body.direction === "up" ? "desc" : "asc" },
  });
  if (neighbor) {
    await prisma.$transaction([
      prisma.fallbackTrack.update({
        where: { id: target.id },
        data: { position: neighbor.position },
      }),
      prisma.fallbackTrack.update({
        where: { id: neighbor.id },
        data: { position: target.position },
      }),
    ]);
  }

  const tracks = await prisma.fallbackTrack.findMany({
    where: { eventId: admin.eventId },
    orderBy: { position: "asc" },
  });
  await notifyFallback(admin.eventId);
  return NextResponse.json({ tracks: tracks.map(toTrack) });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const track = await prisma.fallbackTrack.findUnique({ where: { id } });
  if (!track || track.eventId !== admin.eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.fallbackTrack.delete({ where: { id } });
  await notifyFallback(admin.eventId);
  return NextResponse.json({ ok: true });
}
