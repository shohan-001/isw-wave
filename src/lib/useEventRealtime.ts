"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";
import { eventChannel, type RealtimeEvent } from "./realtime-shared";

export { eventChannel };
export type { RealtimeEvent };

let shared: PusherClient | null = null;

function getClient(): PusherClient | null {
  if (typeof window === "undefined") return null;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim();
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim() || "mt1";
  if (!key) return null;
  if (!shared) {
    shared = new PusherClient(key, { cluster });
  }
  return shared;
}

export function isClientRealtimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY?.trim());
}

 /** Subscribe to an event channel. Returns an unsubscribe fn. */
export function useEventRealtime(
  eventId: string | null | undefined,
  handlers: Partial<Record<RealtimeEvent, () => void>>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!eventId) return;
    const client = getClient();
    if (!client) return;

    const channelName = eventChannel(eventId);
    const channel = client.subscribe(channelName);

    const names = Object.keys(handlersRef.current) as RealtimeEvent[];
    for (const name of names) {
      channel.bind(name, () => {
        handlersRef.current[name]?.();
      });
    }

    return () => {
      for (const name of names) channel.unbind(name);
      client.unsubscribe(channelName);
    };
  }, [eventId]);
}
