import { NextResponse } from "next/server";
import { searchYouTube } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/search?q=...
// Proxies YouTube Data API v3 search server-side so YOUTUBE_API_KEY is never
// exposed to the client. The client throttles calls (500ms debounce + explicit
// Search button) to protect the daily quota — see the request page.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchYouTube(q, 10);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    // Surface a clean error; log the detail server-side.
    console.error("[/api/search]", message);
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
