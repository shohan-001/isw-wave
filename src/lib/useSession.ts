"use client";

import { useEffect, useState } from "react";

const LS_KEY = "isw_session_id";

// Client-side session bootstrap with the in-app-browser fallback.
//
// Flow on mount:
//   1. Read any mirrored id from localStorage.
//   2. POST it to /api/session. The server re-issues the signed cookie from the
//      mirrored id (or its own cookie if present, or a fresh one), and returns
//      the authoritative id.
//   3. Mirror that id back into localStorage.
//
// Why: many in-app browsers (Instagram, WhatsApp, phone camera) clear cookies
// when the mini-browser closes, so the cookie alone loses the attendee's
// identity between visits. localStorage survives more often. This is
// best-effort, NOT bulletproof — some in-app browsers also sandbox
// localStorage, in which case the attendee simply gets a new identity (and a
// fresh request allowance). Phase 2 accounts make this durable.
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      let mirrored: string | null = null;
      try {
        mirrored = localStorage.getItem(LS_KEY);
      } catch {
        // localStorage sandboxed/unavailable — fall through to cookie-only.
      }
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: mirrored }),
        });
        const data = (await res.json()) as { sessionId: string };
        if (cancelled) return;
        setSessionId(data.sessionId);
        try {
          localStorage.setItem(LS_KEY, data.sessionId);
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    sync();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sessionId, ready };
}
