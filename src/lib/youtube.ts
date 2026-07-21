import "server-only";
import { MIN_SONG_SECONDS } from "./constants";

// --- YouTube Data API v3 search (server-side only) ------------------------
//
// The API key lives in YOUTUBE_API_KEY and is NEVER sent to the client — every
// call happens here, behind /api/search.
//
// Quota note: search.list costs 100 units against the 10,000/day free quota.
// The client enforces a 500ms debounce AND an explicit Search button so typing
// can't drain the quota. search.list does not return video duration, so we make
// one extra videos.list call (contentDetails, 1 unit) to fetch durations.
//
// Phase 2: results shorter than MIN_SONG_SECONDS (default 60s) are dropped so
// Shorts/teasers (0:06, 0:15…) never appear as requestable songs. search.list
// costs the same 100 units for 10 or 40 results, so we over-fetch and trim to
// `maxResults` AFTER filtering to still return a full page of usable tracks.

export type SearchResult = {
  youtubeVideoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  durationSeconds: number;
};

// Parse an ISO-8601 duration (e.g. "PT4M13S", "PT1H2M3S") into seconds.
export function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

type YtSearchItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
};

type YtVideoItem = {
  id: string;
  contentDetails: { duration: string };
};

export async function searchYouTube(
  query: string,
  maxResults = 10,
  minSeconds = MIN_SONG_SECONDS
): Promise<SearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY is not set");
  }

  // 1) search.list — over-fetch (same 100-unit cost) so that after dropping
  // short clips we can still return a full page of `maxResults` usable tracks.
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoEmbeddable", "true"); // must be embeddable in our player
  searchUrl.searchParams.set("maxResults", String(Math.min(50, maxResults * 3)));
  searchUrl.searchParams.set("q", query);

  const searchRes = await fetch(searchUrl, { cache: "no-store" });
  if (!searchRes.ok) {
    const body = await searchRes.text();
    throw new Error(`YouTube search failed (${searchRes.status}): ${body}`);
  }
  const searchData = (await searchRes.json()) as { items?: YtSearchItem[] };
  const items = (searchData.items || []).filter((i) => i.id?.videoId);
  if (items.length === 0) return [];

  // 2) videos.list — fetch durations for the returned ids in one call.
  const ids = items.map((i) => i.id.videoId).join(",");
  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("key", key);
  videosUrl.searchParams.set("part", "contentDetails");
  videosUrl.searchParams.set("id", ids);

  const videosRes = await fetch(videosUrl, { cache: "no-store" });
  const durationById = new Map<string, number>();
  if (videosRes.ok) {
    const videosData = (await videosRes.json()) as { items?: YtVideoItem[] };
    for (const v of videosData.items || []) {
      durationById.set(v.id, parseISODuration(v.contentDetails.duration));
    }
  }

  return items
    .map((i) => {
      const t = i.snippet.thumbnails;
      return {
        youtubeVideoId: i.id.videoId,
        title: decodeHtml(i.snippet.title),
        channelName: decodeHtml(i.snippet.channelTitle),
        thumbnailUrl: t.medium?.url || t.high?.url || t.default?.url || "",
        durationSeconds: durationById.get(i.id.videoId) ?? 0,
      };
    })
    // Drop Shorts/teasers below the minimum. A duration of 0 means we couldn't
    // resolve it (videos.list miss) — exclude those too rather than risk
    // surfacing a 6-second clip.
    .filter((r) => r.durationSeconds >= minSeconds)
    .slice(0, maxResults);
}

// YouTube titles arrive HTML-entity encoded (e.g. &amp;, &#39;). Decode the
// common ones for display.
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
