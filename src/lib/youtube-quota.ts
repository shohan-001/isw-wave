import "server-only";
import { prisma } from "./db";

// YouTube Data API v3 free tier: 10,000 units/day.
// search.list = 100 units; videos.list / playlistItems.list = 1 unit each.
export const YOUTUBE_DAILY_QUOTA = 10_000;
export const SEARCH_LIST_COST = 100;
export const VIDEOS_LIST_COST = 1;
export const PLAYLIST_ITEMS_LIST_COST = 1;
export const SEARCH_FLOW_COST = SEARCH_LIST_COST + VIDEOS_LIST_COST;

/** Worst-case units for a playlist import (may over-fetch ~2× ids before filter). */
export function estimatePlaylistImportCost(maxItems: number): number {
  const capped = Math.min(50, Math.max(1, maxItems));
  const pages = Math.max(1, Math.ceil((capped * 2) / 50));
  return pages * PLAYLIST_ITEMS_LIST_COST + pages * VIDEOS_LIST_COST;
}

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

export async function canAffordUnits(units: number): Promise<boolean> {
  if (units <= 0) return true;
  const { remaining } = await getQuotaUsage();
  return remaining >= units;
}

export async function canAffordSearch(): Promise<boolean> {
  return canAffordUnits(SEARCH_FLOW_COST);
}

export async function recordQuotaUnits(units: number): Promise<void> {
  const dayKey = todayKey();
  await prisma.youTubeQuotaDay.upsert({
    where: { dayKey },
    create: { dayKey, unitsUsed: units },
    update: { unitsUsed: { increment: units } },
  });
}

export type EventQuotaUsage = {
  dayKey: string;
  eventId: string;
  unitsUsed: number;
  /** 0 means no per-event cap (global pool only). */
  cap: number;
  remaining: number | null;
  percentUsed: number | null;
  limited: boolean;
};

export async function getEventQuotaUsage(
  eventId: string,
  cap: number
): Promise<EventQuotaUsage> {
  const dayKey = todayKey();
  const row = await prisma.eventYouTubeQuotaDay.findUnique({
    where: { dayKey_eventId: { dayKey, eventId } },
  });
  const unitsUsed = row?.unitsUsed ?? 0;
  if (cap <= 0) {
    return {
      dayKey,
      eventId,
      unitsUsed,
      cap: 0,
      remaining: null,
      percentUsed: null,
      limited: false,
    };
  }
  const remaining = Math.max(0, cap - unitsUsed);
  return {
    dayKey,
    eventId,
    unitsUsed,
    cap,
    remaining,
    percentUsed: Math.round((unitsUsed / cap) * 100),
    limited: remaining < SEARCH_FLOW_COST,
  };
}

export async function canAffordEventUnits(
  eventId: string,
  cap: number,
  units: number
): Promise<boolean> {
  if (cap <= 0 || units <= 0) return true;
  const usage = await getEventQuotaUsage(eventId, cap);
  return (usage.remaining ?? 0) >= units;
}

export async function canAffordEventSearch(
  eventId: string,
  cap: number
): Promise<boolean> {
  return canAffordEventUnits(eventId, cap, SEARCH_FLOW_COST);
}

export async function recordEventQuotaUnits(
  eventId: string,
  units: number
): Promise<void> {
  const dayKey = todayKey();
  await prisma.eventYouTubeQuotaDay.upsert({
    where: { dayKey_eventId: { dayKey, eventId } },
    create: { dayKey, eventId, unitsUsed: units },
    update: { unitsUsed: { increment: units } },
  });
}

/** Batch today's usage for a set of events (ops overview). */
export async function getEventQuotaUsageMap(
  eventIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!eventIds.length) return map;
  const dayKey = todayKey();
  const rows = await prisma.eventYouTubeQuotaDay.findMany({
    where: { dayKey, eventId: { in: eventIds } },
    select: { eventId: true, unitsUsed: true },
  });
  for (const row of rows) map.set(row.eventId, row.unitsUsed);
  return map;
}
