"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueuePayload } from "@/lib/types";
import {
  isClientRealtimeConfigured,
  useEventRealtime,
} from "@/lib/useEventRealtime";

/**
 * Fetch /api/queue with:
 * - in-flight dedupe (never stack parallel polls — that caused request storms)
 * - debounced refetch on Pusher events
 * - slow fallback polling when realtime is configured
 */
export function useQueuePolling(
  intervalMs = 10000,
  opts?: { code?: string | null; eventId?: string | null }
) {
  const [data, setData] = useState<QueuePayload | null>(null);
  const [error, setError] = useState(false);
  const code = opts?.code ?? null;
  const eventId = opts?.eventId ?? null;
  const realtime = isClientRealtimeConfigured();

  const inFlight = useRef(false);
  const pendingAfter = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  const eventIdRef = useRef(eventId);
  const dataEventIdRef = useRef<string | null>(null);
  codeRef.current = code;
  eventIdRef.current = eventId;

  const fetchQueue = useCallback(async () => {
    if (inFlight.current) {
      pendingAfter.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const params = new URLSearchParams();
      if (codeRef.current) params.set("code", codeRef.current);
      else if (eventIdRef.current) params.set("eventId", eventIdRef.current);
      else if (dataEventIdRef.current)
        params.set("eventId", dataEventIdRef.current);
      const qs = params.toString();
      const res = await fetch(`/api/queue${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as QueuePayload;
      dataEventIdRef.current = json.eventId;
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      if (pendingAfter.current) {
        pendingAfter.current = false;
        void fetchQueue();
      }
    }
  }, []);

  const refetchQueue = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchQueue();
    }, 250);
  }, [fetchQueue]);

  useEffect(() => {
    void fetchQueue();
    // With Pusher: rare safety poll. Without: modest interval (never sub-second).
    const ms = realtime
      ? Math.max(intervalMs * 4, 45000)
      : Math.max(intervalMs, 8000);
    const timer = setInterval(() => void fetchQueue(), ms);
    return () => {
      clearInterval(timer);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchQueue, intervalMs, realtime, code, eventId]);

  const resolvedEventId = eventId || data?.eventId || null;
  useEventRealtime(resolvedEventId, {
    "queue:update": refetchQueue,
    "settings:update": refetchQueue,
  });

  return { data, error, realtime, refetch: refetchQueue };
}
