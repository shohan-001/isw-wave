"use client";

import { useEffect, useRef, useState } from "react";
import type { QueuePayload } from "@/lib/types";

 // Poll /api/queue every `intervalMs`. Pass code or eventId so simultaneous
 // events stay isolated (display uses code; admin uses session fallback).
 // TODO(Phase 3): replace polling with a WebSocket subscription.
export function useQueuePolling(
  intervalMs = 5000,
  opts?: { code?: string | null; eventId?: string | null }
) {
  const [data, setData] = useState<QueuePayload | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const code = opts?.code ?? null;
  const eventId = opts?.eventId ?? null;

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
    timer.current = setInterval(tick, intervalMs);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [intervalMs, code, eventId]);

  return { data, error };
}
