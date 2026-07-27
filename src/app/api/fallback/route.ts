import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { FallbackTrack } from "@/lib/types";
import { notifyFallback } from "@/lib/realtime";
import {
  fetchPlaylistVideos,
  parseYouTubePlaylistId,
  type SearchResult,
} from "@/lib/youtube";
import {
  canAffordEventUnits,
  canAffordUnits,
  estimatePlaylistImportCost,
  recordEventQuotaUnits,
  recordQuotaUnits,
} from "@/lib/youtube-quota";
import { getEventSafety, suspendedMessage } from "@/lib/event-safety";

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

async function nextPosition(eventId: string): Promise<number> {
  const last = await prisma.fallbackTrack.findFirst({
    where: { eventId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
}

async function appendTracks(
  eventId: string,
  tracks: SearchResult[]
): Promise<{
  added: number;
  skippedDuplicates: number;
  tracks: FallbackTrack[];
}> {
  const existing = await prisma.fallbackTrack.findMany({
    where: { eventId },
    select: { youtubeVideoId: true },
  });
  const have = new Set(existing.map((t) => t.youtubeVideoId));
  const unique: SearchResult[] = [];
  let skippedDuplicates = 0;
  for (const t of tracks) {
    if (!t.youtubeVideoId || !t.title) continue;
    if (have.has(t.youtubeVideoId)) {
      skippedDuplicates += 1;
      continue;
    }
    have.add(t.youtubeVideoId);
    unique.push(t);
  }

  if (!unique.length) {
    return { added: 0, skippedDuplicates, tracks: [] };
  }

  let position = await nextPosition(eventId);
  const created = await prisma.$transaction(
    unique.map((t) => {
      const row = prisma.fallbackTrack.create({
        data: {
          eventId,
          youtubeVideoId: t.youtubeVideoId,
          title: t.title.slice(0, 200),
          thumbnailUrl: t.thumbnailUrl || "",
          durationSeconds: Math.max(0, Math.floor(t.durationSeconds || 0)),
          channelName: (t.channelName || "").slice(0, 100),
          position,
        },
      });
      position += 1;
      return row;
    })
  );

  await notifyFallback(eventId);
  return {
    added: created.length,
    skippedDuplicates,
    tracks: created.map(toTrack),
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

// POST — single add (legacy) | import_playlist | add_many
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    url?: string;
    maxItems?: number;
    tracks?: SearchResult[];
    youtubeVideoId?: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    channelName?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (body.action === "import_playlist") {
    const playlistId = parseYouTubePlaylistId(body.url || "");
    if (!playlistId) {
      return NextResponse.json(
        { error: "Paste a YouTube playlist URL or playlist id." },
        { status: 400 }
      );
    }

    const safety = await getEventSafety(admin.eventId);
    if (safety?.suspended) {
      return NextResponse.json(
        { error: suspendedMessage(safety.suspendReason) },
        { status: 403 }
      );
    }

    const maxItems = Math.max(
      1,
      Math.min(50, Math.floor(body.maxItems ?? 40))
    );
    const estimate = estimatePlaylistImportCost(maxItems);
    const cap = safety?.youtubeDailyQuotaCap ?? 0;

    if (!(await canAffordUnits(estimate))) {
      return NextResponse.json(
        { error: "Daily YouTube quota exhausted. Try again tomorrow." },
        { status: 429 }
      );
    }
    if (!(await canAffordEventUnits(admin.eventId, cap, estimate))) {
      return NextResponse.json(
        {
          error:
            "This event's YouTube quota for today is used up. Try again tomorrow.",
        },
        { status: 429 }
      );
    }

    let fetched;
    try {
      fetched = await fetchPlaylistVideos(playlistId, { maxItems });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Playlist fetch failed";
      const notFound =
        /404|playlistNotFound|notFound|invalid/i.test(msg) ||
        msg.includes("404");
      return NextResponse.json(
        {
          error: notFound
            ? "Playlist not found or private. Use a public playlist URL."
            : "Could not load playlist from YouTube.",
        },
        { status: notFound ? 404 : 502 }
      );
    }

    if (fetched.unitsSpent > 0) {
      await recordQuotaUnits(fetched.unitsSpent);
      await recordEventQuotaUnits(admin.eventId, fetched.unitsSpent);
    }

    if (!fetched.results.length) {
      return NextResponse.json(
        {
          error:
            "No usable tracks in that playlist (private, short clips, or empty).",
          added: 0,
          skippedDuplicates: 0,
          tracks: [],
        },
        { status: 422 }
      );
    }

    const result = await appendTracks(admin.eventId, fetched.results);
    return NextResponse.json(result, { status: 201 });
  }

  if (body.action === "add_many") {
    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (!tracks.length) {
      return NextResponse.json({ error: "No tracks to add." }, { status: 400 });
    }
    if (tracks.length > 50) {
      return NextResponse.json(
        { error: "Max 50 tracks per batch." },
        { status: 400 }
      );
    }
    const result = await appendTracks(admin.eventId, tracks);
    return NextResponse.json(result, { status: 201 });
  }

  // Legacy single-add
  if (!body.youtubeVideoId || !body.title) {
    return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  }

  const position = await nextPosition(admin.eventId);
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

// PATCH — bulk reorder { orderedIds } or step swap { id, direction }
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    orderedIds?: string[];
    id?: string;
    direction?: "up" | "down";
  };

  // Drag / jump / optimistic save — one write of the full order.
  if (Array.isArray(body.orderedIds)) {
    const orderedIds = body.orderedIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
    const existing = await prisma.fallbackTrack.findMany({
      where: { eventId: admin.eventId },
      select: { id: true },
    });
    if (
      orderedIds.length !== existing.length ||
      orderedIds.length !== new Set(orderedIds).size
    ) {
      return NextResponse.json(
        { error: "orderedIds must list every fallback track once." },
        { status: 400 }
      );
    }
    const allowed = new Set(existing.map((t) => t.id));
    if (!orderedIds.every((id) => allowed.has(id))) {
      return NextResponse.json(
        { error: "orderedIds contains unknown tracks." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.fallbackTrack.update({
          where: { id },
          data: { position: index + 1 },
        })
      )
    );

    const tracks = await prisma.fallbackTrack.findMany({
      where: { eventId: admin.eventId },
      orderBy: { position: "asc" },
    });
    await notifyFallback(admin.eventId);
    return NextResponse.json({ tracks: tracks.map(toTrack) });
  }

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
