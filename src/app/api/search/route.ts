import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEventSafety, suspendedMessage } from "@/lib/event-safety";
import { getCachedSearch, setCachedSearch } from "@/lib/youtube-cache";
import {
  canAffordEventSearch,
  canAffordSearch,
  getEventQuotaUsage,
  getQuotaUsage,
  recordEventQuotaUnits,
  recordQuotaUnits,
  SEARCH_FLOW_COST,
} from "@/lib/youtube-quota";
import { searchYouTube } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/search?q=...
// Requires a participant or admin session so usage can be attributed to an event.
// Cache hits (15 min) don't spend units. Uncached searches charge SEARCH_FLOW_COST
// against both the global day counter and the event's daily counter.
export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session?.eventId) {
    return NextResponse.json(
      { error: "Join an event or sign in as an organizer to search." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const safety = await getEventSafety(session.eventId);
  if (!safety) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Guests of a suspended event can't burn search; organizer control room can.
  if (safety.suspended && session.role === "participant") {
    return NextResponse.json(
      {
        error: suspendedMessage(safety.suspendReason),
        suspended: true,
      },
      { status: 403 }
    );
  }

  try {
    const cached = await getCachedSearch(q);
    if (cached) {
      const [quota, eventQuota] = await Promise.all([
        getQuotaUsage(),
        getEventQuotaUsage(safety.id, safety.youtubeDailyQuotaCap),
      ]);
      return NextResponse.json({
        results: cached,
        cached: true,
        quota,
        eventQuota,
      });
    }

    if (!(await canAffordSearch())) {
      const quota = await getQuotaUsage();
      return NextResponse.json(
        {
          error:
            "Search is temporarily limited — we've hit today's YouTube API quota. Try again in a few hours.",
          quotaLimited: true,
          quota,
        },
        { status: 429 }
      );
    }

    if (
      !(await canAffordEventSearch(safety.id, safety.youtubeDailyQuotaCap))
    ) {
      const [quota, eventQuota] = await Promise.all([
        getQuotaUsage(),
        getEventQuotaUsage(safety.id, safety.youtubeDailyQuotaCap),
      ]);
      return NextResponse.json(
        {
          error:
            "This event has used its YouTube search budget for today. Try again tomorrow, or ask the ISW Wave team to raise the cap.",
          eventQuotaLimited: true,
          quota,
          eventQuota,
        },
        { status: 429 }
      );
    }

    const results = await searchYouTube(q, 10);
    await recordQuotaUnits(SEARCH_FLOW_COST);
    await recordEventQuotaUnits(safety.id, SEARCH_FLOW_COST);
    await setCachedSearch(q, results);

    const [quota, eventQuota] = await Promise.all([
      getQuotaUsage(),
      getEventQuotaUsage(safety.id, safety.youtubeDailyQuotaCap),
    ]);
    return NextResponse.json({
      results,
      cached: false,
      quota,
      eventQuota,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    console.error("[/api/search]", message);

    if (/quotaExceeded|dailyLimitExceeded|403/.test(message)) {
      const quota = await getQuotaUsage();
      return NextResponse.json(
        {
          error:
            "Search is temporarily limited — YouTube API quota exhausted. Try again shortly.",
          quotaLimited: true,
          quota,
        },
        { status: 429 }
      );
    }

    const isKey = message.includes("YOUTUBE_API_KEY");
    return NextResponse.json(
      {
        error: isKey
          ? "YouTube API key is not configured on the server."
          : "Search failed. Please try again.",
      },
      { status: isKey ? 500 : 502 }
    );
  }
}
