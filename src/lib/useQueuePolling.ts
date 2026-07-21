"use client";

import { useEffect, useRef, useState } from "react";
import type { QueuePayload } from "@/lib/types";

// Poll /api/queue every `intervalMs` (default 5s). Both the Display page and the
// Admin dashboard use this to stay in sync.
// TODO(Phase 3): replace this polling with a WebSocket subscription — the
// consuming components only depend on the returned QueuePayload shape, so the
// swap is isolated to this hook.
export function useQueuePolling(intervalMs = 5000) {
  const [data, setData] = useState<QueuePayload | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const res = await fetch("/api/queue", { cache: "no-store" });
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
  }, [intervalMs]);

  return { data, error };
}
