import "server-only";
import { prisma } from "./db";
import type { SearchResult } from "./youtube";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getCachedSearch(
  query: string
): Promise<SearchResult[] | null> {
  const queryKey = normalizeSearchQuery(query);
  if (queryKey.length < 2) return null;

  const row = await prisma.searchCache.findUnique({ where: { queryKey } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.searchCache.delete({ where: { queryKey } }).catch(() => {});
    return null;
  }

  try {
    return JSON.parse(row.results) as SearchResult[];
  } catch {
    return null;
  }
}

export async function setCachedSearch(
  query: string,
  results: SearchResult[]
): Promise<void> {
  const queryKey = normalizeSearchQuery(query);
  if (queryKey.length < 2) return;

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.searchCache.upsert({
    where: { queryKey },
    create: {
      queryKey,
      results: JSON.stringify(results),
      expiresAt,
    },
    update: {
      results: JSON.stringify(results),
      expiresAt,
    },
  });
}
