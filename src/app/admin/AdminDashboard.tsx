"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { useYouTubePlayer } from "@/lib/useYouTubePlayer";
import {
  isClientRealtimeConfigured,
  useEventRealtime,
} from "@/lib/useEventRealtime";
import {
  formatDuration,
  type FallbackTrack,
  type PublicRequest,
  type Settings,
} from "@/lib/types";
import type { SearchResult } from "@/lib/youtube";

type PendingSort = "votes" | "time";

export function AdminDashboard({
  eventId,
  initialAccessCode,
}: {
  eventId: string;
  initialAccessCode: string;
}) {
  const { data, realtime } = useQueuePolling(5000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];

  const [pending, setPending] = useState<PublicRequest[]>([]);
  const [pendingSort, setPendingSort] = useState<PendingSort>("votes");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fallback, setFallback] = useState<FallbackTrack[]>([]);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const [fbQuery, setFbQuery] = useState("");
  const [fbResults, setFbResults] = useState<SearchResult[]>([]);
  const [fbSearching, setFbSearching] = useState(false);

  const loadPending = useCallback(async () => {
    const res = await fetch(
      `/api/requests?status=pending&sort=${pendingSort}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const d = (await res.json()) as { requests: PublicRequest[] };
      setPending(d.requests);
    }
  }, [pendingSort]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { settings: Settings };
      setSettings(d.settings);
    }
  }, []);

  const loadFallback = useCallback(async () => {
    const res = await fetch("/api/fallback", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { tracks: FallbackTrack[] };
      setFallback(d.tracks);
    }
  }, []);

  useEffect(() => {
    loadPending();
    loadSettings();
    loadFallback();
  }, [loadPending, loadSettings, loadFallback]);

  // Slow poll only when Pusher isn't configured.
  useEffect(() => {
    if (isClientRealtimeConfigured()) return;
    const t = setInterval(loadPending, 5000);
    return () => clearInterval(t);
  }, [loadPending]);

  useEventRealtime(eventId, {
    "pending:update": () => void loadPending(),
    "fallback:update": () => void loadFallback(),
    "settings:update": () => void loadSettings(),
  });

  const usingFallback = !now && queue.length === 0 && fallback.length > 0;
  const fallbackTrack = usingFallback
    ? fallback[fallbackIndex % fallback.length]
    : null;

  const activeVideoId =
    now?.youtubeVideoId ?? fallbackTrack?.youtubeVideoId ?? null;
  const nextVideoId = now
    ? queue[0]?.youtubeVideoId ?? null
    : usingFallback && fallback.length > 1
    ? fallback[(fallbackIndex + 1) % fallback.length]?.youtubeVideoId ?? null
    : null;

  const advance = useCallback(async () => {
    if (now) {
      await fetch(`/api/requests/${now.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "next" }),
      });
      return;
    }
    if (usingFallback && fallback.length > 0) {
      setFallbackIndex((i) => (i + 1) % fallback.length);
    }
  }, [now, usingFallback, fallback.length]);

  const player = useYouTubePlayer({
    videoId: activeVideoId,
    nextVideoId,
    onEnded: advance,
  });

  // Promote first queued song when nothing is "now playing".
  useEffect(() => {
    if (!now && queue.length > 0) {
      void act(queue[0].id, "play");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, queue.length]);

  // Reset fallback index when leaving fallback mode.
  useEffect(() => {
    if (now || queue.length > 0) setFallbackIndex(0);
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

  async function searchFallback(e: React.FormEvent) {
    e.preventDefault();
    const q = fbQuery.trim();
    if (q.length < 2) return;
    setFbSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const d = await res.json();
      setFbResults(res.ok ? (d.results as SearchResult[]) : []);
    } finally {
      setFbSearching(false);
    }
  }

  async function addFallback(r: SearchResult) {
    await fetch("/api/fallback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        youtubeVideoId: r.youtubeVideoId,
        title: r.title,
        thumbnailUrl: r.thumbnailUrl,
        durationSeconds: r.durationSeconds,
        channelName: r.channelName,
      }),
    });
    setFbResults([]);
    setFbQuery("");
    await loadFallback();
  }

  async function fallbackAct(id: string, action: "up" | "down" | "delete") {
    if (action === "delete") {
      await fetch(`/api/fallback?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } else {
      await fetch("/api/fallback", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, direction: action }),
      });
    }
    await loadFallback();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const accessCode = settings?.accessCode ?? initialAccessCode;
  const displayHref = `/display?code=${encodeURIComponent(accessCode)}`;

  const sourceLabel = useMemo(() => {
    if (now) return "Live queue";
    if (usingFallback) return "Fallback playlist";
    return "Idle";
  }, [now, usingFallback]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Control Room
          </h1>
          <p className="text-sm text-white/45">
            {data?.eventName ?? "ISW Wave"}
            <span className="mx-2 text-white/20">·</span>
            <span className={realtime ? "text-pulse" : "text-white/35"}>
              {realtime ? "Live" : "Polling"}
            </span>
          </p>
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
        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-white/10 bg-surface/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-wave/15 px-3 py-1 text-xs font-semibold text-wave-400">
                <span className="h-2 w-2 rounded-full bg-wave" />
                {sourceLabel} · venue audio
              </span>
              <PlayerStateTag state={player.state} />
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black">
              <div className="aspect-video w-full">
                <div ref={player.mainRef} className="h-full w-full" />
              </div>
              <AnimatePresence>
                {activeVideoId && !player.audioUnlocked && player.ready && (
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
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <div
              ref={player.preloadRef}
              className="pointer-events-none absolute h-px w-px opacity-0"
              aria-hidden
            />

            {now ? (
              <div className="mt-4">
                <p className="line-clamp-1 font-display text-lg font-semibold text-white">
                  {now.title}
                </p>
                <p className="text-sm text-white/45">
                  {now.requesterName} · {formatDuration(now.durationSeconds)}
                </p>
              </div>
            ) : fallbackTrack ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-pulse">
                  Fallback
                </p>
                <p className="line-clamp-1 font-display text-lg font-semibold text-white">
                  {fallbackTrack.title}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/40">
                Nothing playing. Approve a song or add fallback tracks.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={player.play}
                disabled={!player.ready || !activeVideoId}
                className="rounded-xl bg-pulse px-5 py-2.5 text-sm font-bold text-ink transition active:scale-95 disabled:opacity-40"
              >
                ▶ Play
              </button>
              <button
                onClick={player.pause}
                disabled={!player.ready || !activeVideoId}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
              >
                ❚❚ Pause
              </button>
              <button
                onClick={advance}
                disabled={!activeVideoId}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
              >
                ⏭ Next
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
                  Queue is empty
                  {fallback.length > 0 ? " — playing fallback." : "."}
                </li>
              )}
            </ul>
          </section>

          {/* Fallback playlist */}
          <section className="rounded-3xl border border-white/10 bg-surface/40 p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-white">
              Fallback playlist{" "}
              <span className="text-white/30">{fallback.length}</span>
            </h2>
            <p className="mb-4 text-xs text-white/45">
              Plays on loop when the approved queue is empty. Live requests
              always take priority.
            </p>

            <form onSubmit={searchFallback} className="mb-3 flex gap-2">
              <input
                value={fbQuery}
                onChange={(e) => setFbQuery(e.target.value)}
                placeholder="Search YouTube to add…"
                className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={fbSearching}
                className="rounded-xl bg-wave px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {fbSearching ? "…" : "Search"}
              </button>
            </form>

            {fbResults.length > 0 && (
              <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto">
                {fbResults.map((r) => (
                  <li key={r.youtubeVideoId}>
                    <button
                      type="button"
                      onClick={() => addFallback(r)}
                      className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-ink-800/60 p-2 text-left transition hover:border-wave/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-9 w-14 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-xs font-medium text-white">
                          {r.title}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {formatDuration(r.durationSeconds)}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-pulse">Add</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <ul className="flex flex-col gap-2">
              {fallback.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-ink-800/40 p-2"
                >
                  <span className="w-5 text-center text-xs font-bold text-white/40">
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.thumbnailUrl}
                    alt=""
                    className="h-9 w-14 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 line-clamp-1 text-xs text-white">
                    {t.title}
                  </span>
                  <IconBtn
                    label="Up"
                    disabled={i === 0}
                    onClick={() => fallbackAct(t.id, "up")}
                  >
                    ↑
                  </IconBtn>
                  <IconBtn
                    label="Down"
                    disabled={i === fallback.length - 1}
                    onClick={() => fallbackAct(t.id, "down")}
                  >
                    ↓
                  </IconBtn>
                  <IconBtn
                    label="Remove"
                    danger
                    onClick={() => fallbackAct(t.id, "delete")}
                  >
                    ✕
                  </IconBtn>
                </li>
              ))}
              {fallback.length === 0 && (
                <li className="py-3 text-center text-sm text-white/30">
                  No fallback tracks yet.
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-white/10 bg-surface/40 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-white">
                Pending{" "}
                <span className="text-white/30">{pending.length}</span>
              </h2>
              <div className="flex rounded-lg bg-ink-800 p-0.5 text-xs font-semibold">
                {(["votes", "time"] as PendingSort[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPendingSort(s)}
                    className={`rounded-md px-2.5 py-1 transition ${
                      pendingSort === s
                        ? "bg-wave text-white"
                        : "text-white/45"
                    }`}
                  >
                    {s === "votes" ? "By votes" : "By time"}
                  </button>
                ))}
              </div>
            </div>
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
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>
                            {r.requesterName} ·{" "}
                            {formatDuration(r.durationSeconds)}
                          </span>
                          <span className="rounded-full bg-wave/20 px-2 py-0.5 font-semibold text-wave-400">
                            ▲ {r.voteCount}
                          </span>
                          {r.flagged && (
                            <span
                              title={r.flagReason}
                              className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300"
                            >
                              Flagged
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                    {r.flagged && r.flagReason && (
                      <p className="mt-2 text-xs text-amber-300/80">
                        {r.flagReason}
                      </p>
                    )}
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
                <button
                  type="button"
                  disabled={codeBusy}
                  onClick={regenerateCode}
                  className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  {codeBusy ? "Generating…" : "Generate new code"}
                </button>
              </div>

              <SettingRow
                title="Request limit"
                hint="Active requests allowed per attendee."
              >
                <Stepper
                  value={settings.requestLimit}
                  onChange={(n) => updateSettings({ requestLimit: n })}
                  min={1}
                  max={20}
                />
              </SettingRow>

              <SettingRow
                title="Approval mode"
                hint="Manual = you approve. Auto = straight to queue."
              >
                <Toggle
                  on={settings.approvalMode === "auto"}
                  onToggle={() =>
                    updateSettings({
                      approvalMode:
                        settings.approvalMode === "manual" ? "auto" : "manual",
                    })
                  }
                />
              </SettingRow>

              <div className="my-4 border-t border-white/10" />
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                Auto-moderation
              </p>

              <SettingRow
                title="Max song length"
                hint="0 = disabled. Default 8 minutes (480s)."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    step={30}
                    value={settings.maxSongSeconds}
                    onChange={(e) =>
                      updateSettings({
                        maxSongSeconds: Number(e.target.value) || 0,
                      })
                    }
                    className="w-20 rounded-lg border border-white/15 bg-ink-800 px-2 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-white/40">sec</span>
                </div>
              </SettingRow>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-medium text-white">
                  Blocked keywords
                </span>
                <span className="mb-2 block text-xs text-white/45">
                  Comma or newline separated. Matched against video titles.
                </span>
                <textarea
                  value={settings.blockedKeywords}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      blockedKeywords: e.target.value,
                    })
                  }
                  onBlur={() =>
                    updateSettings({
                      blockedKeywords: settings.blockedKeywords,
                    })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  placeholder="explicit, nsfw, …"
                />
              </label>

              <SettingRow
                title="On violation"
                hint="Reject blocks submit. Flag keeps it pending with a warning."
              >
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      autoModMode:
                        settings.autoModMode === "reject" ? "flag" : "reject",
                    })
                  }
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {settings.autoModMode === "reject" ? "Auto-reject" : "Flag only"}
                </button>
              </SettingRow>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function SettingRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/45">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-8 rounded-lg border border-white/15 text-white"
      >
        −
      </button>
      <span className="w-6 text-center font-display text-lg font-bold text-white">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-8 rounded-lg border border-white/15 text-white"
      >
        +
      </button>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-8 w-16 rounded-full transition ${
        on ? "bg-wave" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
          on ? "left-9" : "left-1"
        }`}
      />
    </button>
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
