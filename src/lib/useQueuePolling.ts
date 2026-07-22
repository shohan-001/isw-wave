"use client";

import { useEffect, useRef, useState } from "react";
import type { QueuePayload } from "@/lib/types";
import {
  isClientRealtimeConfigured,
  useEventRealtime,
} from "@/lib/useEventRealtime";

 // Fetch /api/queue. Prefer Pusher push; fall back to 5s polling when unset.
 // TODO(Phase 3): polling remains as graceful degradation without Pusher keys.
export function useQueuePolling(
  intervalMs = 5000,
  opts?: { code?: string | null; eventId?: string | null }
) {
  const [data, setData] = useState<QueuePayload | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const code = opts?.code ?? null;
  const eventId = opts?.eventId ?? null;
  const realtime = isClientRealtimeConfigured();

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const params = new URLSearchParams();
        if (code) params.set("code", code);
        else if (eventId) params.set("eventId", eventId);
        const qs = params.toString();
        const res = await fetch(`/api/queue${qs ? `?${qs}` : ""}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as QueuePayload;
        if (active) {
          setData(json);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    }
    tick();
    // Poll only when realtime isn't configured (or as a slow safety net).
    const ms = realtime ? Math.max(intervalMs * 6, 30000) : intervalMs;
    timer.current = setInterval(tick, ms);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [intervalMs, code, eventId, realtime]);

  const resolvedEventId = eventId || data?.eventId || null;
  const refetchQueue = () => {
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (code) params.set("code", code);
        else if (resolvedEventId) params.set("eventId", resolvedEventId);
        const qs = params.toString();
        const res = await fetch(`/api/queue${qs ? `?${qs}` : ""}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        setData((await res.json()) as QueuePayload);
        setError(false);
      } catch {
        /* ignore — next poll will retry */
      }
    })();
  };

  useEventRealtime(resolvedEventId, {
    "queue:update": refetchQueue,
    // Theme/logo/displayMode live on the queue payload for public screens.
    "settings:update": refetchQueue,
  });

  return { data, error, realtime, refetch: refetchQueue };
}
