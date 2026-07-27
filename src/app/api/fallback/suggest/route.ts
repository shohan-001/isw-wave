import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { fetchPopularMusic, type SearchResult } from "@/lib/youtube";
import {
  canAffordEventUnits,
  canAffordUnits,
  recordEventQuotaUnits,
  recordQuotaUnits,
  VIDEOS_LIST_COST,
} from "@/lib/youtube-quota";
import { getEventSafety, suspendedMessage } from "@/lib/event-safety";

export const dynamic = "force-dynamic";

const EVENT_SUGGEST_LIMIT = 30;
const THIN_THRESHOLD = 8;
const NEAR_EMPTY_FALLBACK = 3;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safety = await getEventSafety(admin.eventId);
  if (safety?.suspended) {
    return NextResponse.json(
      { error: suspendedMessage(safety.suspendReason) },
      { status: 403 }
    );
  }

  const existing = await prisma.fallbackTrack.findMany({
    where: { eventId: admin.eventId },
    select: { youtubeVideoId: true },
  });
  const inFallback = new Set(existing.map((t) => t.youtubeVideoId));
  const fallbackCount = existing.length;

  const played = await prisma.request.findMany({
    where: {
      eventId: admin.eventId,
      status: { in: [STATUS.PLAYED, STATUS.APPROVED] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      youtubeVideoId: true,
      title: true,
      channelName: true,
      thumbnailUrl: true,
      durationSeconds: true,
    },
    take: 120,
  });

  const suggestions: SearchResult[] = [];
  const seen = new Set<string>();
  for (const r of played) {
    if (!r.youtubeVideoId || inFallback.has(r.youtubeVideoId)) continue;
    if (seen.has(r.youtubeVideoId)) continue;
    seen.add(r.youtubeVideoId);
    suggestions.push({
      youtubeVideoId: r.youtubeVideoId,
      title: r.title,
      channelName: r.channelName || "",
      thumbnailUrl: r.thumbnailUrl || "",
      durationSeconds: r.durationSeconds || 0,
    });
    if (suggestions.length >= EVENT_SUGGEST_LIMIT) break;
  }

  let source: "event" | "mixed" | "popular" =
    suggestions.length > 0 ? "event" : "popular";

  const needsTopUp =
    suggestions.length < THIN_THRESHOLD &&
    fallbackCount <= NEAR_EMPTY_FALLBACK;

  if (needsTopUp) {
    const cap = safety?.youtubeDailyQuotaCap ?? 0;
    const canSpend =
      (await canAffordUnits(VIDEOS_LIST_COST)) &&
      (await canAffordEventUnits(admin.eventId, cap, VIDEOS_LIST_COST));

    if (canSpend) {
      try {
        const popular = await fetchPopularMusic({ maxResults: 20 });
        if (popular.unitsSpent > 0) {
          await recordQuotaUnits(popular.unitsSpent);
          await recordEventQuotaUnits(admin.eventId, popular.unitsSpent);
        }

        let addedPopular = 0;
        for (const p of popular.results) {
          if (inFallback.has(p.youtubeVideoId) || seen.has(p.youtubeVideoId)) {
            continue;
          }
          seen.add(p.youtubeVideoId);
          suggestions.push(p);
          addedPopular += 1;
          if (suggestions.length >= EVENT_SUGGEST_LIMIT) break;
        }

        if (addedPopular > 0) {
          source = suggestions.length === addedPopular ? "popular" : "mixed";
        }
      } catch {
        // Popular chart is optional — keep event-only list.
        if (suggestions.length > 0) source = "event";
      }
    }
  }

  if (suggestions.length === 0) {
    source = "event";
  }

  return NextResponse.json({ suggestions, source });
}
