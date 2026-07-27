import "server-only";
import Pusher from "pusher";
import {
  eventChannel,
  type RealtimeEvent,
} from "./realtime-shared";

export { eventChannel, type RealtimeEvent };

let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (pusher) return pusher;
  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  const cluster = process.env.PUSHER_CLUSTER?.trim() || "mt1";
  if (!appId || !key || !secret) return null;
  pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return pusher;
}

export function isRealtimeConfigured(): boolean {
  return Boolean(getPusher());
}

export async function publishEvent(
  eventId: string,
  name: RealtimeEvent,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const client = getPusher();
  if (!client) return;
  try {
    await client.trigger(eventChannel(eventId), name, {
      ...payload,
      at: Date.now(),
    });
  } catch (err) {
    console.error("[realtime] publish failed", name, err);
  }
}

/** Fan-out helpers used by API routes after mutations. */
export async function notifyQueue(eventId: string) {
  await publishEvent(eventId, "queue:update");
}
export async function notifyPending(eventId: string) {
  await publishEvent(eventId, "pending:update");
}
export async function notifyRequests(eventId: string) {
  await publishEvent(eventId, "requests:update");
}
export async function notifyFallback(eventId: string) {
  await publishEvent(eventId, "fallback:update");
}
export async function notifySettings(eventId: string) {
  await publishEvent(eventId, "settings:update");
}
