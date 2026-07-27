import "server-only";
import { MIN_SONG_SECONDS } from "./constants";

// --- YouTube Data API v3 search (server-side only) ------------------------
//
// The API key lives in YOUTUBE_API_KEY and is NEVER sent to the client — every
// call happens here, behind /api/search.
//
// Quota note: search.list costs 100 units against the 10,000/day free quota.
//
// Phase 5: identical searches are cached in the DB (see youtube-cache.ts) and
// daily usage is tracked (youtube-quota.ts). At higher scale, the real fix is
// either a Google API quota increase or per-organizer API keys — not implemented.
//
// Phase 6+ consideration: native admin apps remain out of scope; web admin only.
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
  snippet?: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: { duration: string };
  status?: { embeddable?: boolean };
};

export type YoutubeFetchResult = {
  results: SearchResult[];
  /** Actual Data API units spent for this call (playlistItems + videos.list). */
  unitsSpent: number;
};

/** Extract a playlist id from a URL or bare PL… / OL… / UU… id. */
export function parseYouTubePlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw) && !raw.includes("://")) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    ) {
      const list = url.searchParams.get("list");
      if (list && /^[a-zA-Z0-9_-]{10,}$/.test(list)) return list;
    }
  } catch {
    // not a URL
  }

  const m = raw.match(/[?&]list=([a-zA-Z0-9_-]{10,})/);
  return m?.[1] ?? null;
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

/** Fetch duration + embeddable metadata for up to 50 ids (1 unit). */
async function fetchVideoDetails(
  ids: string[],
  minSeconds: number
): Promise<{ byId: Map<string, SearchResult>; unitsSpent: number }> {
  const byId = new Map<string, SearchResult>();
  if (!ids.length) return { byId, unitsSpent: 0 };

  const key = apiKey();
  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("key", key);
  videosUrl.searchParams.set("part", "snippet,contentDetails,status");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosRes = await fetch(videosUrl, { cache: "no-store" });
  if (!videosRes.ok) {
    const body = await videosRes.text();
    throw new Error(`YouTube videos.list failed (${videosRes.status}): ${body}`);
  }
  const videosData = (await videosRes.json()) as { items?: YtVideoItem[] };
  for (const v of videosData.items || []) {
    if (v.status && v.status.embeddable === false) continue;
    const durationSeconds = parseISODuration(v.contentDetails.duration);
    if (durationSeconds < minSeconds) continue;
    const t = v.snippet?.thumbnails;
    byId.set(v.id, {
      youtubeVideoId: v.id,
      title: decodeHtml(v.snippet?.title || "Untitled"),
      channelName: decodeHtml(v.snippet?.channelTitle || ""),
      thumbnailUrl: t?.medium?.url || t?.high?.url || t?.default?.url || "",
      durationSeconds,
    });
  }
  return { byId, unitsSpent: 1 };
}

/**
 * Expand a public playlist into embeddable tracks (playlistItems + videos.list).
 * Caps at `maxItems` after duration filtering. Cost ≈ 1 unit per page of 50
 * playlist items + 1 unit per videos.list batch — never search.list.
 */
export async function fetchPlaylistVideos(
  playlistId: string,
  opts: { maxItems?: number; minSeconds?: number } = {}
): Promise<YoutubeFetchResult> {
  const maxItems = Math.max(1, Math.min(50, opts.maxItems ?? 40));
  const minSeconds = opts.minSeconds ?? MIN_SONG_SECONDS;
  const key = apiKey();

  const collectedIds: string[] = [];
  let pageToken = "";
  let unitsSpent = 0;

  while (collectedIds.length < maxItems * 2) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("key", key);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { cache: "no-store" });
    unitsSpent += 1;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `YouTube playlistItems.list failed (${res.status}): ${body}`
      );
    }
    const data = (await res.json()) as {
      items?: { contentDetails?: { videoId?: string } }[];
      nextPageToken?: string;
    };
    for (const item of data.items || []) {
      const id = item.contentDetails?.videoId;
      if (id) collectedIds.push(id);
    }
    if (!data.nextPageToken || collectedIds.length >= maxItems * 2) break;
    pageToken = data.nextPageToken;
  }

  const uniqueIds = Array.from(new Set(collectedIds));
  const results: SearchResult[] = [];

  for (let i = 0; i < uniqueIds.length && results.length < maxItems; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    const { byId, unitsSpent: u } = await fetchVideoDetails(batch, minSeconds);
    unitsSpent += u;
    for (const id of batch) {
      const hit = byId.get(id);
      if (hit) {
        results.push(hit);
        if (results.length >= maxItems) break;
      }
    }
  }

  return { results, unitsSpent };
}

const popularCache = new Map<
  string,
  { dayKey: string; results: SearchResult[] }
>();

/**
 * Cheap cold-start seed: most popular Music-category videos (~1 unit).
 * Cached in-process per UTC day + region.
 */
export async function fetchPopularMusic(
  opts: { regionCode?: string; maxResults?: number; minSeconds?: number } = {}
): Promise<YoutubeFetchResult> {
  const regionCode = (opts.regionCode || "US").toUpperCase().slice(0, 2);
  const maxResults = Math.max(1, Math.min(30, opts.maxResults ?? 20));
  const minSeconds = opts.minSeconds ?? MIN_SONG_SECONDS;
  const dayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `${dayKey}:${regionCode}`;

  const cached = popularCache.get(cacheKey);
  if (cached && cached.dayKey === dayKey) {
    return { results: cached.results.slice(0, maxResults), unitsSpent: 0 };
  }

  const key = apiKey();
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", key);
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("videoCategoryId", "10"); // Music
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", String(Math.min(50, maxResults * 2)));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `YouTube popular music failed (${res.status}): ${body}`
    );
  }
  const data = (await res.json()) as { items?: YtVideoItem[] };
  const results: SearchResult[] = [];
  for (const v of data.items || []) {
    if (v.status && v.status.embeddable === false) continue;
    const durationSeconds = parseISODuration(v.contentDetails.duration);
    if (durationSeconds < minSeconds) continue;
    const t = v.snippet?.thumbnails;
    results.push({
      youtubeVideoId: v.id,
      title: decodeHtml(v.snippet?.title || "Untitled"),
      channelName: decodeHtml(v.snippet?.channelTitle || ""),
      thumbnailUrl: t?.medium?.url || t?.high?.url || t?.default?.url || "",
      durationSeconds,
    });
    if (results.length >= maxResults) break;
  }

  popularCache.set(cacheKey, { dayKey, results });
  return { results, unitsSpent: 1 };
}

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
