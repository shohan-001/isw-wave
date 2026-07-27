import "server-only";

export type ModerationHit = {
  reason: string;
};

export function parseBlockedKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
}

 /** Returns a moderation hit if the request violates event rules. */
export function checkAutoModeration(opts: {
  title: string;
  durationSeconds: number;
  maxSongSeconds: number;
  blockedKeywords: string;
}): ModerationHit | null {
  const { title, durationSeconds, maxSongSeconds, blockedKeywords } = opts;

  if (maxSongSeconds > 0 && durationSeconds > maxSongSeconds) {
    const mins = Math.round(maxSongSeconds / 60);
    return {
      reason: `Song is longer than the ${mins}-minute limit (${Math.ceil(durationSeconds / 60)} min).`,
    };
  }

  const keywords = parseBlockedKeywords(blockedKeywords);
  if (keywords.length === 0) return null;

  const hay = title.toLowerCase();
  const hit = keywords.find((kw) => hay.includes(kw));
  if (hit) {
    return { reason: `Title matched blocked keyword "${hit}".` };
  }
  return null;
}
