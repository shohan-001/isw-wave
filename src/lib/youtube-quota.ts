import "server-only";
import { prisma } from "./db";

// YouTube Data API v3 free tier: 10,000 units/day.
// search.list = 100 units; videos.list = 1 unit per search flow.
export const YOUTUBE_DAILY_QUOTA = 10_000;
export const SEARCH_LIST_COST = 100;
export const VIDEOS_LIST_COST = 1;
export const SEARCH_FLOW_COST = SEARCH_LIST_COST + VIDEOS_LIST_COST;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getQuotaUsage(): Promise<{
  dayKey: string;
  unitsUsed: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}> {
  const dayKey = todayKey();
  const row = await prisma.youTubeQuotaDay.findUnique({ where: { dayKey } });
  const unitsUsed = row?.unitsUsed ?? 0;
  const remaining = Math.max(0, YOUTUBE_DAILY_QUOTA - unitsUsed);
  return {
    dayKey,
    unitsUsed,
    limit: YOUTUBE_DAILY_QUOTA,
    remaining,
    percentUsed: Math.round((unitsUsed / YOUTUBE_DAILY_QUOTA) * 100),
  };
}

export async function canAffordSearch(): Promise<boolean> {
  const { remaining } = await getQuotaUsage();
  return remaining >= SEARCH_FLOW_COST;
}

export async function recordQuotaUnits(units: number): Promise<void> {
  const dayKey = todayKey();
  await prisma.youTubeQuotaDay.upsert({
    where: { dayKey },
    create: { dayKey, unitsUsed: units },
    update: { unitsUsed: { increment: units } },
  });
}

// Phase 6+ consideration (do not implement yet):
// - Request a Google API quota increase for production scale, OR
// - Let each organizer supply their own YOUTUBE_API_KEY per Organization.
