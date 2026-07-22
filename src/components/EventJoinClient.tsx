"use client";

import { useEffect, useState } from "react";
import { DEVICE_ID_KEY } from "@/lib/constants";
import type { AuthUser } from "@/lib/types";
import { RequestClient } from "@/app/RequestClient";

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `tmp-${Date.now()}`;
  }
}

export function EventJoinClient({
  eventName,
  eventSlug,
  accessCode,
  accentColor,
  logoUrl,
  initialUser,
}: {
  eventName: string;
  eventSlug: string;
  accessCode: string;
  accentColor: string;
  logoUrl: string;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedName, setLockedName] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser?.role === "participant" && initialUser.eventSlug === eventSlug) {
      setUser(initialUser);
    }
  }, [initialUser, eventSlug]);

  if (user?.role === "participant" && user.eventSlug === eventSlug) {
    return (
      <RequestClient
        eventName={eventName}
        accentColor={accentColor}
        logoUrl={logoUrl}
        user={user}
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const deviceId = getOrCreateDeviceId();
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug: eventSlug, deviceId }),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        error?: string;
        lockedName?: string;
      };
      if (!res.ok || !data.user) {
        if (data.lockedName) {
          setLockedName(data.lockedName);
          setName(data.lockedName);
        }
        setError(data.error || "Could not join.");
        setBusy(false);
        return;
      }
      setUser(data.user);
      window.location.reload();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{eventName}</h1>
          <p className="mt-1 text-sm text-white/45">
            Enter your name to request songs. Code on screen:{" "}
            <span className="font-mono text-pulse">{accessCode}</span>
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={lockedName || "Alex"}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
            required
          />
        </label>
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-pulse px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join event"}
        </button>
      </form>
    </main>
  );
}
