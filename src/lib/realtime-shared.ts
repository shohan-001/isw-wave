// Shared between server realtime.ts and client hooks (no server-only / pusher).

export type RealtimeEvent =
  | "queue:update"
  | "pending:update"
  | "requests:update"
  | "fallback:update"
  | "settings:update";

export function eventChannel(eventId: string): string {
  return `event-${eventId}`;
}
