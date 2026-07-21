"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/types";

// Client-side auth state. Bootstraps from /api/auth/me on mount; components use
// `ready` to avoid a flash before the user is known. Phase 2 replaces the
// Phase-1 anonymous session bootstrap — identity is a real account now.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, ready, refresh, logout };
}
