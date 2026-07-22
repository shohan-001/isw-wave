"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { useYouTubePlayer } from "@/lib/useYouTubePlayer";
import { formatDuration, type PublicRequest, type Settings } from "@/lib/types";

export function AdminDashboard({
  eventId,
  initialAccessCode,
}: {
  eventId: string;
  initialAccessCode: string;
}) {
  const { data } = useQueuePolling(5000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];

  const [pending, setPending] = useState<PublicRequest[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  // Poll pending requests every 5s (separate from the public queue endpoint).
  const loadPending = useCallback(async () => {
    const res = await fetch("/api/requests?status=pending", {
      cache: "no-store",
    });
    if (res.ok) {
      const d = (await res.json()) as { requests: PublicRequest[] };
      setPending(d.requests);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { settings: Settings };
      setSettings(d.settings);
    }
  }, []);

  useEffect(() => {
    loadPending();
    loadSettings();
    const t = setInterval(loadPending, 5000);
    return () => clearInterval(t);
  }, [loadPending, loadSettings]);

  // --- Player wiring ---
  const nextVideoId = queue[0]?.youtubeVideoId ?? null;
  const advance = useCallback(async () => {
    if (!now) return;
    await fetch(`/api/requests/${now.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "next" }),
    });
  }, [now]);

  const player = useYouTubePlayer({
    videoId: now?.youtubeVideoId ?? null,
    nextVideoId,
    onEnded: advance,
  });

  // If nothing is playing but the queue has songs, promote the first one.
  useEffect(() => {
    if (!now && queue.length > 0) {
      void act(queue[0].id, "play");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, queue.length]);

  async function act(
    id: string,
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setBusyId(id);
    try {
      await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      await loadPending();
    } finally {
      setBusyId(null);
    }
  }

  async function updateSettings(
    patch: Partial<Settings> & { regenerateCode?: boolean }
  ) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const d = (await res.json()) as { settings: Settings };
      setSettings(d.settings);
    }
  }

  async function regenerateCode() {
    setCodeBusy(true);
    try {
      await updateSettings({ regenerateCode: true });
    } finally {
      setCodeBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const accessCode = settings?.accessCode ?? initialAccessCode;
  const displayHref = `/display?code=${encodeURIComponent(accessCode)}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Control Room
          </h1>
          <p className="text-sm text-white/45">{data?.eventName ?? "ISW Wave"}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={displayHref}
            target="_blank"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-pulse/40"
          >
            Open display ↗
          </a>
          <button
            onClick={logout}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/50 transition hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT column: player + queue */}
        <div className="flex flex-col gap-6">
          {/* Player */}
          <section className="rounded-3xl border border-white/10 bg-surface/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-wave/15 px-3 py-1 text-xs font-semibold text-wave-400">
                <span className="h-2 w-2 rounded-full bg-wave" />
                This device controls venue audio
              </span>
              <PlayerStateTag state={player.state} />
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black">
              {/* Active audio-producing player (required visible by YT ToS). */}
              <div className="aspect-video w-full">
                <div ref={player.mainRef} className="h-full w-full" />
              </div>

              {/* One-time gesture unlock for browser autoplay policy. Shown
                  until the first user-initiated play; after that, auto-advance
                  between songs autoplays on its own. */}
              <AnimatePresence>
                {now && !player.audioUnlocked && player.ready && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={player.unlock}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/80 backdrop-blur-sm"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-wave text-2xl shadow-glow">
                      ▶
                    </span>
                    <span className="font-display text-lg font-bold text-white">
                      Tap to enable audio
                    </span>
                    <span className="max-w-xs text-center text-xs text-white/50">
                      Browsers require one tap before sound can play. After this,
                      songs advance automatically.
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {/* Hidden preload player instance. */}
            <div
              ref={player.preloadRef}
              className="pointer-events-none absolute h-px w-px opacity-0"
              aria-hidden
            />

            {/* Now playing meta + transport */}
            {now ? (
              <div className="mt-4">
                <p className="line-clamp-1 font-display text-lg font-semibold text-white">
                  {now.title}
                </p>
                <p className="text-sm text-white/45">
                  {now.requesterName} · {formatDuration(now.durationSeconds)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/40">
                Nothing playing. Approve a song to start the queue.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={player.play}
                disabled={!player.ready || !now}
                className="rounded-xl bg-pulse px-5 py-2.5 text-sm font-bold text-ink transition active:scale-95 disabled:opacity-40"
              >
                ▶ Play
              </button>
              <button
                onClick={player.pause}
                disabled={!player.ready || !now}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
              >
                ❚❚ Pause
              </button>
              <button
                onClick={advance}
                disabled={!now}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
              >
                ⏭ Next / Mark played
              </button>

              <label className="ml-auto flex items-center gap-2 text-sm text-white/50">
                🔊
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  className="w-32 accent-wave"
                />
              </label>
            </div>
          </section>

          {/* Queue */}
          <section className="rounded-3xl border border-white/10 bg-surface/40 p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-white">
              Queue <span className="text-white/30">{queue.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {queue.map((r, i) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-ink-800/50 p-2.5"
                  >
                    <span className="w-5 text-center text-sm font-bold text-wave-400">
                      {i + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.thumbnailUrl}
                      alt=""
                      className="h-10 w-16 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-white">
                        {r.title}
                      </span>
                      <span className="truncate text-xs text-white/45">
                        {r.requesterName}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <IconBtn
                        label="Move up"
                        disabled={i === 0 || busyId === r.id}
                        onClick={() => act(r.id, "move", { direction: "up" })}
                      >
                        ↑
                      </IconBtn>
                      <IconBtn
                        label="Move down"
                        disabled={i === queue.length - 1 || busyId === r.id}
                        onClick={() => act(r.id, "move", { direction: "down" })}
                      >
                        ↓
                      </IconBtn>
                      <IconBtn
                        label="Play now"
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "play")}
                      >
                        ▶
                      </IconBtn>
                      <IconBtn
                        label="Remove"
                        danger
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "remove")}
                      >
                        ✕
                      </IconBtn>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
              {queue.length === 0 && (
                <li className="py-4 text-center text-sm text-white/30">
                  Queue is empty.
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* RIGHT column: pending + settings */}
        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-white/10 bg-surface/40 p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-white">
              Pending{" "}
              <span className="text-white/30">{pending.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {pending.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="rounded-2xl border border-white/5 bg-ink-800/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-12 w-20 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-white">
                          {r.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/45">
                          {r.requesterName} · {formatDuration(r.durationSeconds)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => act(r.id, "approve")}
                        disabled={busyId === r.id}
                        className="flex-1 rounded-lg bg-pulse py-2 text-sm font-bold text-ink transition active:scale-[0.98] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => act(r.id, "reject")}
                        disabled={busyId === r.id}
                        className="flex-1 rounded-lg border border-red-500/40 py-2 text-sm font-semibold text-red-300 transition active:scale-[0.98] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
              {pending.length === 0 && (
                <li className="py-4 text-center text-sm text-white/30">
                  No pending requests.
                </li>
              )}
            </ul>
          </section>

          {/* Settings */}
          {settings && (
            <section className="rounded-3xl border border-white/10 bg-surface/40 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold text-white">
                Settings
              </h2>

              <div className="mb-4 rounded-2xl border border-wave/30 bg-wave/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-wave-400">
                  Event code
                </p>
                <p className="mt-1 font-display text-3xl font-bold tracking-[0.2em] text-white">
                  {settings.accessCode}
                </p>
                <p className="mt-2 text-xs text-white/45">
                  Show this on the display with the QR. Guests join with their
                  name + this code — no signup.
                </p>
                <button
                  type="button"
                  disabled={codeBusy}
                  onClick={regenerateCode}
                  className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  {codeBusy ? "Generating…" : "Generate new code"}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    Request limit
                  </p>
                  <p className="text-xs text-white/45">
                    Active requests allowed per attendee.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateSettings({
                        requestLimit: Math.max(1, settings.requestLimit - 1),
                      })
                    }
                    className="h-8 w-8 rounded-lg border border-white/15 text-white"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-display text-lg font-bold text-white">
                    {settings.requestLimit}
                  </span>
                  <button
                    onClick={() =>
                      updateSettings({
                        requestLimit: settings.requestLimit + 1,
                      })
                    }
                    className="h-8 w-8 rounded-lg border border-white/15 text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    Approval mode
                  </p>
                  <p className="text-xs text-white/45">
                    Manual = you approve each song. Auto = straight to queue.
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSettings({
                      approvalMode:
                        settings.approvalMode === "manual" ? "auto" : "manual",
                    })
                  }
                  className={`relative h-8 w-16 rounded-full transition ${
                    settings.approvalMode === "auto"
                      ? "bg-wave"
                      : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      settings.approvalMode === "auto" ? "left-9" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-center text-xs font-medium text-white/40">
                {settings.approvalMode === "auto"
                  ? "Auto-approve ON"
                  : "Manual approve ON"}
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function PlayerStateTag({ state }: { state: string }) {
  const label =
    state === "playing"
      ? "Playing"
      : state === "paused"
      ? "Paused"
      : state === "buffering"
      ? "Buffering"
      : state === "ended"
      ? "Ended"
      : "Idle";
  return (
    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
      {label}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition active:scale-90 disabled:opacity-30 ${
        danger
          ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
          : "border-white/15 text-white/70 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
