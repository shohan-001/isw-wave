import { NextResponse } from "next/server";
import { getCachedSearch, setCachedSearch } from "@/lib/youtube-cache";
import {
  canAffordSearch,
  getQuotaUsage,
  recordQuotaUnits,
  SEARCH_FLOW_COST,
} from "@/lib/youtube-quota";
import { searchYouTube } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/search?q=...
// Server-side YouTube search with DB cache (15 min) and daily quota tracking.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const cached = await getCachedSearch(q);
    if (cached) {
      const quota = await getQuotaUsage();
      return NextResponse.json({ results: cached, cached: true, quota });
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

    const results = await searchYouTube(q, 10);
    await recordQuotaUnits(SEARCH_FLOW_COST);
    await setCachedSearch(q, results);

    const quota = await getQuotaUsage();
    return NextResponse.json({ results, cached: false, quota });
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
