import "server-only";
import { prisma } from "./db";

export type EventSafety = {
  id: string;
  suspended: boolean;
  suspendReason: string;
  youtubeDailyQuotaCap: number;
};

/** Load the fields needed to enforce suspend + per-event quota. */
export async function getEventSafety(
  eventId: string
): Promise<EventSafety | null> {
  if (!eventId) return null;
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      suspended: true,
      suspendReason: true,
      youtubeDailyQuotaCap: true,
    },
  });
}

export function suspendedMessage(reason?: string): string {
  const note = (reason || "").trim();
  return note
    ? `This event is suspended: ${note}`
    : "This event is temporarily suspended. Guests can't join or request songs right now.";
}
