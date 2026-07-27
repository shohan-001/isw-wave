"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  Reorder,
  motion,
  useDragControls,
} from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { EventTheme } from "@/components/EventTheme";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { useYouTubePlayer } from "@/lib/useYouTubePlayer";
import {
  isClientRealtimeConfigured,
  useEventRealtime,
} from "@/lib/useEventRealtime";
import {
  formatDuration,
  type EventStats,
  type FallbackTrack,
  type PublicRequest,
  type QuotaInfo,
  type Settings,
} from "@/lib/types";
import {
  accentContrastOk,
  normalizeHex,
  DEFAULT_ACCENT,
} from "@/lib/theme";
import type { SearchResult } from "@/lib/youtube";

type PendingSort = "votes" | "time" | "requester";
type QueueSort = "position" | "time" | "requester";

export function AdminDashboard({
  eventId,
  eventSlug,
  initialAccent,
}: {
  eventId: string;
  eventSlug: string;
  initialAccent?: string;
}) {
  const { data, realtime, refetch } = useQueuePolling(8000, { eventId });
  // Queue API mirrors fallback onto nowPlaying for the hall display — never treat
  // that as a live request or we'll clear currentFallbackId in a tight loop.
  const now =
    data?.nowPlaying && !data.nowPlayingIsFallback ? data.nowPlaying : null;
  const queue = useMemo(() => data?.queue ?? [], [data?.queue]);
  const syncedFallbackId = useRef<string | null>(null);
  const advancingRef = useRef(false);

  const [pending, setPending] = useState<PublicRequest[]>([]);
  const [pendingSort, setPendingSort] = useState<PendingSort>("votes");
  const [queueSort, setQueueSort] = useState<QueueSort>("position");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [fallback, setFallback] = useState<FallbackTrack[]>([]);
  const fallbackPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const fallbackOrderDirty = useRef(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [bulkKeyword, setBulkKeyword] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [eventNameDraft, setEventNameDraft] = useState("");
  const [accentDraft, setAccentDraft] = useState(
    normalizeHex(initialAccent || "") || DEFAULT_ACCENT
  );
  const [logoDraft, setLogoDraft] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const [fbQuery, setFbQuery] = useState("");
  const [fbResults, setFbResults] = useState<SearchResult[]>([]);
  const [fbSearching, setFbSearching] = useState(false);
  const [fbPlaylistUrl, setFbPlaylistUrl] = useState("");
  const [fbImporting, setFbImporting] = useState(false);
  const [fbSuggesting, setFbSuggesting] = useState(false);
  const [fbSuggestions, setFbSuggestions] = useState<SearchResult[]>([]);
  const [fbSuggestSource, setFbSuggestSource] = useState<
    "event" | "mixed" | "popular" | null
  >(null);
  const [fbSelected, setFbSelected] = useState<Set<string>>(new Set());
  const [fbAddingMany, setFbAddingMany] = useState(false);
  const [fbMsg, setFbMsg] = useState<string | null>(null);
  const [fbErr, setFbErr] = useState<string | null>(null);

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
      setEventNameDraft(d.settings.eventName);
      setAccentDraft(d.settings.accentColor || DEFAULT_ACCENT);
      setLogoDraft(d.settings.logoUrl || "");
    }
  }, []);

  const loadFallback = useCallback(async () => {
    const res = await fetch("/api/fallback", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { tracks: FallbackTrack[] };
      setFallback(d.tracks);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { stats: EventStats };
      setStats(d.stats);
    }
  }, []);

  const loadQuota = useCallback(async () => {
    const res = await fetch("/api/quota", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { quota: QuotaInfo };
      setQuota(d.quota);
    }
  }, []);

  useEffect(() => {
    loadPending();
    loadSettings();
    loadFallback();
    loadStats();
    loadQuota();
  }, [loadPending, loadSettings, loadFallback, loadStats, loadQuota]);

  // Slow poll only when Pusher isn't configured.
  useEffect(() => {
    if (isClientRealtimeConfigured()) return;
    const t = setInterval(loadPending, 5000);
    return () => clearInterval(t);
  }, [loadPending]);

  // Stats + quota refresh every 10s.
  useEffect(() => {
    const t = setInterval(() => {
      void loadStats();
      void loadQuota();
    }, 10000);
    return () => clearInterval(t);
  }, [loadStats, loadQuota]);

  useEventRealtime(eventId, {
    "pending:update": () => {
      void loadPending();
      void loadStats();
    },
    "queue:update": () => {
      void loadStats();
    },
    "fallback:update": () => {
      // Don't clobber an in-flight optimistic reorder with a stale echo.
      if (fallbackOrderDirty.current) return;
      void loadFallback();
    },
    "settings:update": () => void loadSettings(),
  });

  // Server may still report a mirrored fallback while approved songs wait in queue.
  const serverFallbackId =
    data?.nowPlayingIsFallback && data.nowPlaying
      ? data.nowPlaying.id
      : null;

  // Local sticky so we keep finishing the current fallback after an approve fills the queue.
  const [localFallbackId, setLocalFallbackId] = useState<string | null>(null);
  const stickyFallbackId = localFallbackId ?? serverFallbackId;

  const idleFallbackMode = !now && queue.length === 0 && fallback.length > 0;
  const finishingFallback =
    !now && queue.length > 0 && Boolean(stickyFallbackId);

  const fallbackTrack = useMemo(() => {
    if (now || fallback.length === 0) return null;
    if (idleFallbackMode) {
      return fallback[fallbackIndex % fallback.length] ?? null;
    }
    if (finishingFallback && stickyFallbackId) {
      return fallback.find((t) => t.id === stickyFallbackId) ?? null;
    }
    return null;
  }, [
    now,
    fallback,
    fallbackIndex,
    idleFallbackMode,
    finishingFallback,
    stickyFallbackId,
  ]);

  const usingFallback = Boolean(fallbackTrack);

  // Track which fallback is on stage while looping (survives queue filling mid-song).
  useEffect(() => {
    if (idleFallbackMode) {
      const t = fallback[fallbackIndex % fallback.length];
      if (t) setLocalFallbackId(t.id);
    }
  }, [idleFallbackMode, fallback, fallbackIndex]);

  useEffect(() => {
    if (now) setLocalFallbackId(null);
  }, [now]);

  // Keep the hall display in sync when admin is on fallback audio (incl. finishing).
  useEffect(() => {
    if (fallbackTrack) {
      if (syncedFallbackId.current === fallbackTrack.id) return;
      syncedFallbackId.current = fallbackTrack.id;
      void fetch("/api/playback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fallbackId: fallbackTrack.id }),
      });
      return;
    }
    // Live request owns the stage — clear any leftover fallback pointer.
    if (now && syncedFallbackId.current !== null) {
      syncedFallbackId.current = null;
      void fetch("/api/playback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fallbackId: null }),
      });
    }
  }, [fallbackTrack, now]);

  const activeVideoId =
    now?.youtubeVideoId ?? fallbackTrack?.youtubeVideoId ?? null;
  const nextVideoId = now
    ? queue[0]?.youtubeVideoId ?? null
    : queue.length > 0
      ? queue[0]?.youtubeVideoId ?? null
      : usingFallback && fallback.length > 1
        ? fallback[(fallbackIndex + 1) % fallback.length]?.youtubeVideoId ??
          null
        : null;

  const advance = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (now) {
        await fetch(`/api/requests/${now.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "next" }),
        });
        // Don't wait for the next poll — load the new current track now.
        refetch();
        return;
      }
      // Fallback ended: prefer waiting approved requests over the next fallback track.
      if (queue.length > 0) {
        const nextId = queue[0]?.id;
        if (nextId) {
          await fetch(`/api/requests/${nextId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "play" }),
          });
          setLocalFallbackId(null);
          refetch();
        }
        return;
      }
      if (fallback.length > 0) {
        setFallbackIndex((i) => (i + 1) % fallback.length);
      }
    } finally {
      // Allow a new ENDED only after the next video has had time to load.
      window.setTimeout(() => {
        advancingRef.current = false;
      }, 1200);
    }
  }, [now, queue, fallback.length, refetch]);

  const player = useYouTubePlayer({
    videoId: activeVideoId,
    nextVideoId,
    onEnded: advance,
  });

  // Push YouTube timeline sparingly — display interpolates between snapshots.
  useEffect(() => {
    if (!player.ready || !activeVideoId) return;
    const tick = () => {
      if (player.state !== "playing" && player.state !== "paused") return;
      void fetch("/api/playback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          positionSec: player.getCurrentTime(),
          playing: player.state === "playing",
        }),
      });
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [player.ready, player.state, player.getCurrentTime, activeVideoId]);

  // Reset server timeline when the loaded video changes.
  useEffect(() => {
    if (!activeVideoId) return;
    void fetch("/api/playback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resetTimeline: true, playing: true, positionSec: 0 }),
    });
  }, [activeVideoId]);

  // Promote first queued song only when the stage is empty (not mid-fallback).
  useEffect(() => {
    if (!now && queue.length > 0 && !fallbackTrack) {
      void act(queue[0]!.id, "play");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, queue.length, fallbackTrack?.id]);

  // Reset fallback loop index only after a live request takes the stage.
  useEffect(() => {
    if (now) setFallbackIndex(0);
  }, [now]);

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
      await Promise.all([loadPending(), loadStats()]);
      refetch();
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
      setEventNameDraft(d.settings.eventName);
      setAccentDraft(d.settings.accentColor || DEFAULT_ACCENT);
      setLogoDraft(d.settings.logoUrl || "");
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

  async function bulkReject() {
    const keyword = bulkKeyword.trim();
    if (keyword.length < 2) return;
    setBulkBusy(true);
    try {
      await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", keyword }),
      });
      setBulkKeyword("");
      await Promise.all([loadPending(), loadStats()]);
    } finally {
      setBulkBusy(false);
    }
  }

  async function searchFallback(e: React.FormEvent) {
    e.preventDefault();
    const q = fbQuery.trim();
    if (q.length < 2) return;
    setFbSearching(true);
    setFbErr(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const d = await res.json();
      setFbResults(res.ok ? (d.results as SearchResult[]) : []);
      if (!res.ok) {
        setFbErr(d.error || "Search failed.");
      }
    } finally {
      setFbSearching(false);
    }
  }

  async function addFallback(r: SearchResult) {
    setFbErr(null);
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

  async function importPlaylist(e: React.FormEvent) {
    e.preventDefault();
    const url = fbPlaylistUrl.trim();
    if (!url) return;
    setFbImporting(true);
    setFbMsg(null);
    setFbErr(null);
    try {
      const res = await fetch("/api/fallback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import_playlist", url }),
      });
      const d = (await res.json()) as {
        error?: string;
        added?: number;
        skippedDuplicates?: number;
      };
      if (!res.ok) {
        setFbErr(d.error || "Import failed.");
        return;
      }
      setFbMsg(
        `Added ${d.added ?? 0} · skipped ${d.skippedDuplicates ?? 0} duplicates`
      );
      setFbPlaylistUrl("");
      await loadFallback();
    } finally {
      setFbImporting(false);
    }
  }

  async function loadSuggestions() {
    setFbSuggesting(true);
    setFbMsg(null);
    setFbErr(null);
    try {
      const res = await fetch("/api/fallback/suggest", { cache: "no-store" });
      const d = (await res.json()) as {
        error?: string;
        suggestions?: SearchResult[];
        source?: "event" | "mixed" | "popular";
      };
      if (!res.ok) {
        setFbErr(d.error || "Could not load suggestions.");
        return;
      }
      const list = d.suggestions || [];
      setFbSuggestions(list);
      setFbSuggestSource(d.source || null);
      setFbSelected(new Set(list.map((s) => s.youtubeVideoId)));
      if (!list.length) {
        setFbMsg(
          "No suggestions yet — play a few requests, or import a playlist."
        );
      }
    } finally {
      setFbSuggesting(false);
    }
  }

  function toggleSuggest(id: string) {
    setFbSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelectedSuggestions(all = false) {
    const tracks = all
      ? fbSuggestions
      : fbSuggestions.filter((s) => fbSelected.has(s.youtubeVideoId));
    if (!tracks.length) return;
    setFbAddingMany(true);
    setFbMsg(null);
    setFbErr(null);
    try {
      const res = await fetch("/api/fallback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add_many", tracks }),
      });
      const d = (await res.json()) as {
        error?: string;
        added?: number;
        skippedDuplicates?: number;
      };
      if (!res.ok) {
        setFbErr(d.error || "Could not add tracks.");
        return;
      }
      setFbMsg(
        `Added ${d.added ?? 0} · skipped ${d.skippedDuplicates ?? 0} duplicates`
      );
      setFbSuggestions([]);
      setFbSelected(new Set());
      setFbSuggestSource(null);
      await loadFallback();
    } finally {
      setFbAddingMany(false);
    }
  }

  const persistFallbackOrder = useCallback((tracks: FallbackTrack[]) => {
    fallbackOrderDirty.current = true;
    if (fallbackPersistTimer.current) {
      clearTimeout(fallbackPersistTimer.current);
    }
    const orderedIds = tracks.map((t) => t.id);
    fallbackPersistTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/fallback", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        });
        if (!res.ok) return;
        const d = (await res.json()) as { tracks?: FallbackTrack[] };
        if (!d.tracks) return;
        setFallback((prev) => {
          const matches =
            prev.length === d.tracks!.length &&
            prev.every((t, i) => t.id === d.tracks![i].id);
          return matches ? d.tracks! : prev;
        });
      } finally {
        fallbackOrderDirty.current = false;
      }
    }, 200);
  }, []);

  function applyFallbackOrder(next: FallbackTrack[]) {
    setFallback(next);
    persistFallbackOrder(next);
  }

  function moveFallback(id: string, direction: "up" | "down") {
    setFallback((prev) => {
      const i = prev.findIndex((t) => t.id === id);
      if (i < 0) return prev;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      persistFallbackOrder(next);
      return next;
    });
  }

  function jumpFallback(id: string, to: "top" | "bottom") {
    setFallback((prev) => {
      const i = prev.findIndex((t) => t.id === id);
      if (i < 0) return prev;
      if (to === "top" && i === 0) return prev;
      if (to === "bottom" && i === prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      if (!item) return prev;
      if (to === "top") next.unshift(item);
      else next.push(item);
      persistFallbackOrder(next);
      return next;
    });
  }

  async function deleteFallback(id: string) {
    setFallback((prev) => prev.filter((t) => t.id !== id));
    fallbackOrderDirty.current = true;
    await fetch(`/api/fallback?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    fallbackOrderDirty.current = false;
    await loadFallback();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function applyAccent(raw: string) {
    const hex = normalizeHex(raw);
    if (!hex) return;
    setAccentDraft(hex);
    void updateSettings({ accentColor: hex });
  }

  // Keyboard shortcuts: A approve · R reject · N next
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        t?.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        const first = pending[0];
        if (first && busyId !== first.id) void act(first.id, "approve");
      } else if (key === "r") {
        e.preventDefault();
        const first = pending[0];
        if (first && busyId !== first.id) void act(first.id, "reject");
      } else if (key === "n") {
        e.preventDefault();
        if (activeVideoId) void advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busyId, activeVideoId, advance]);

  const displayedQueue = useMemo(() => {
    if (queueSort === "position") return queue;
    const copy = [...queue];
    if (queueSort === "time") {
      copy.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else {
      copy.sort((a, b) =>
        a.requesterName.localeCompare(b.requesterName, undefined, {
          sensitivity: "base",
        })
      );
    }
    return copy;
  }, [queue, queueSort]);

  const displayHref = `/e/${eventSlug}/display`;
  const accent =
    settings?.accentColor ||
    normalizeHex(initialAccent || "") ||
    DEFAULT_ACCENT;
  const logoUrl = settings?.logoUrl || "";
  const contrastOk = accentContrastOk(accentDraft);

  const sourceLabel = useMemo(() => {
    if (now) return "Live queue";
    if (finishingFallback) return "Finishing fallback";
    if (usingFallback) return "Fallback playlist";
    return "Idle";
  }, [now, finishingFallback, usingFallback]);

  return (
    <EventTheme accentColor={accent}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <BrandMark size={40} showWordmark={false} />
            )}
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                Control Room
              </h1>
              <p className="text-sm text-white/45">
                {settings?.eventName ?? data?.eventName ?? "ISW Wave"}
                <span className="mx-2 text-white/20">·</span>
                <span className={realtime ? "text-pulse" : "text-white/35"}>
                  {realtime ? "Live" : "Polling"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            <p className="hidden text-[11px] text-white/35 sm:block">
              Shortcuts: A approve · R reject · N next
            </p>
            <a
              href="/organizer"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-pulse/40"
            >
              All events
            </a>
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

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatChip label="Total" value={String(stats.totalRequests)} />
            <StatChip label="Approved" value={String(stats.approved)} />
            <StatChip label="Rejected" value={String(stats.rejected)} />
            <StatChip label="Queue" value={String(stats.queueLength)} />
            <StatChip
              label="Top requester"
              value={
                stats.mostActiveRequester
                  ? `${stats.mostActiveRequester} (${stats.mostActiveCount})`
                  : "—"
              }
              className="col-span-2 sm:col-span-1"
            />
            {quota ? (
              <StatChip
                label="YouTube quota"
                value={`${quota.percentUsed}%`}
                className={
                  quota.percentUsed >= 85
                    ? "border-amber-500/40 text-amber-200"
                    : undefined
                }
              />
            ) : null}
          </div>
        )}

        <p className="mb-4 text-center text-[11px] text-white/35 sm:hidden">
          Shortcuts: A approve · R reject · N next
        </p>

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
                    {finishingFallback
                      ? "Finishing fallback · request up next"
                      : "Fallback"}
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-white">
                  Queue <span className="text-white/30">{queue.length}</span>
                </h2>
                <div className="flex rounded-lg bg-ink-800 p-0.5 text-xs font-semibold">
                  {(
                    [
                      ["position", "Pos"],
                      ["time", "Time"],
                      ["requester", "Who"],
                    ] as const
                  ).map(([s, label]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQueueSort(s)}
                      className={`rounded-md px-2.5 py-1 transition ${
                        queueSort === s
                          ? "bg-wave text-white"
                          : "text-white/45"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {displayedQueue.map((r) => {
                    const apiIndex = queue.findIndex((q) => q.id === r.id);
                    return (
                      <motion.li
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-ink-800/50 p-2.5"
                      >
                        <span className="w-5 text-center text-sm font-bold text-wave-400">
                          {apiIndex + 1}
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
                            disabled={apiIndex === 0 || busyId === r.id}
                            onClick={() =>
                              act(r.id, "move", { direction: "up" })
                            }
                          >
                            ↑
                          </IconBtn>
                          <IconBtn
                            label="Move down"
                            disabled={
                              apiIndex === queue.length - 1 || busyId === r.id
                            }
                            onClick={() =>
                              act(r.id, "move", { direction: "down" })
                            }
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
                    );
                  })}
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
              <p className="mb-3 text-xs text-white/45">
                Live requests always win. Drag the handle to reorder, or use ↑↓ /
                top·bottom. Import a playlist or suggest tracks — YouTube
                doesn&apos;t expose its recommendation algorithm to apps.
              </p>

              <form onSubmit={importPlaylist} className="mb-3 flex gap-2">
                <input
                  value={fbPlaylistUrl}
                  onChange={(e) => setFbPlaylistUrl(e.target.value)}
                  placeholder="Paste YouTube playlist URL…"
                  className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={fbImporting || !fbPlaylistUrl.trim()}
                  className="rounded-xl bg-wave px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {fbImporting ? "…" : "Import"}
                </button>
              </form>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadSuggestions()}
                  disabled={fbSuggesting}
                  className="rounded-xl border border-white/15 bg-ink-800 px-3 py-2 text-xs font-semibold text-white transition hover:border-wave/40 disabled:opacity-50"
                >
                  {fbSuggesting ? "Loading…" : "Suggest tracks"}
                </button>
                {fbSuggestions.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => void addSelectedSuggestions(false)}
                      disabled={fbAddingMany || fbSelected.size === 0}
                      className="rounded-xl bg-pulse px-3 py-2 text-xs font-bold text-ink-900 disabled:opacity-50"
                    >
                      {fbAddingMany
                        ? "Adding…"
                        : `Add selected (${fbSelected.size})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => void addSelectedSuggestions(true)}
                      disabled={fbAddingMany}
                      className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:border-wave/40 disabled:opacity-50"
                    >
                      Add all
                    </button>
                    {fbSuggestSource && (
                      <span className="text-[10px] text-white/35">
                        Source:{" "}
                        {fbSuggestSource === "event"
                          ? "this event"
                          : fbSuggestSource === "mixed"
                            ? "event + popular"
                            : "popular music"}
                      </span>
                    )}
                  </>
                )}
              </div>

              {fbSuggestions.length > 0 && (
                <ul className="mb-4 max-h-56 space-y-1 overflow-y-auto">
                  {fbSuggestions.map((r) => {
                    const checked = fbSelected.has(r.youtubeVideoId);
                    return (
                      <li key={r.youtubeVideoId}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-ink-800/60 p-2 transition hover:border-wave/40">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSuggest(r.youtubeVideoId)}
                            className="accent-wave"
                          />
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
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <form onSubmit={searchFallback} className="mb-3 flex gap-2">
                <input
                  value={fbQuery}
                  onChange={(e) => setFbQuery(e.target.value)}
                  placeholder="Search YouTube to add one…"
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

              {fbMsg && (
                <p className="mb-2 text-xs text-pulse">{fbMsg}</p>
              )}
              {fbErr && (
                <p className="mb-2 text-xs text-rose-300">{fbErr}</p>
              )}

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

              {fallback.length > 0 ? (
                <Reorder.Group
                  axis="y"
                  values={fallback}
                  onReorder={applyFallbackOrder}
                  className="flex flex-col gap-2"
                >
                  {fallback.map((t, i) => (
                    <FallbackReorderRow
                      key={t.id}
                      track={t}
                      index={i}
                      total={fallback.length}
                      onMoveUp={() => moveFallback(t.id, "up")}
                      onMoveDown={() => moveFallback(t.id, "down")}
                      onJumpTop={() => jumpFallback(t.id, "top")}
                      onJumpBottom={() => jumpFallback(t.id, "bottom")}
                      onDelete={() => void deleteFallback(t.id)}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <p className="py-3 text-center text-sm text-white/30">
                  No fallback tracks yet.
                </p>
              )}
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
                  {(
                    [
                      ["votes", "Votes"],
                      ["time", "Time"],
                      ["requester", "Who"],
                    ] as const
                  ).map(([s, label]) => (
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
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  value={bulkKeyword}
                  onChange={(e) => setBulkKeyword(e.target.value)}
                  placeholder="Bulk reject by keyword…"
                  className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={bulkBusy || bulkKeyword.trim().length < 2}
                  onClick={bulkReject}
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                >
                  {bulkBusy ? "…" : "Reject all"}
                </button>
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
                    Event URL
                  </p>
                  <p className="mt-1 font-mono text-sm text-white/80">
                    /e/{eventSlug}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-wave-400">
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
                          settings.approvalMode === "manual"
                            ? "auto"
                            : "manual",
                      })
                    }
                  />
                </SettingRow>

                <div className="my-4 border-t border-white/10" />
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Theme
                </p>

                <label className="mb-3 block">
                  <span className="mb-1.5 block text-sm font-medium text-white">
                    Event name
                  </span>
                  <input
                    value={eventNameDraft}
                    onChange={(e) => setEventNameDraft(e.target.value)}
                    onBlur={() => {
                      const name = eventNameDraft.trim();
                      if (name && name !== settings.eventName) {
                        void updateSettings({ eventName: name });
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  />
                </label>

                <div className="mb-3">
                  <span className="mb-1.5 block text-sm font-medium text-white">
                    Accent color
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={normalizeHex(accentDraft) || DEFAULT_ACCENT}
                      onChange={(e) => applyAccent(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-ink-800 p-1"
                    />
                    <input
                      value={accentDraft}
                      onChange={(e) => setAccentDraft(e.target.value)}
                      onBlur={() => applyAccent(accentDraft)}
                      placeholder="#e0338f"
                      className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 font-mono text-sm text-white focus:border-wave/50 focus:outline-none"
                    />
                  </div>
                  {!contrastOk && (
                    <p className="mt-2 text-xs text-amber-300/90">
                      Low contrast on dark background — may be hard to read
                    </p>
                  )}
                </div>

                <label className="mb-3 block">
                  <span className="mb-1.5 block text-sm font-medium text-white">
                    Logo URL
                  </span>
                  <span className="mb-2 block text-xs text-white/45">
                    Optional image URL shown in Control Room and display.
                  </span>
                  <input
                    value={logoDraft}
                    onChange={(e) => setLogoDraft(e.target.value)}
                    onBlur={() => {
                      if (logoDraft !== (settings.logoUrl || "")) {
                        void updateSettings({ logoUrl: logoDraft.trim() });
                      }
                    }}
                    placeholder="https://…"
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  />
                </label>

                <SettingRow
                  title="Display mode"
                  hint="Minimal hides extras on the public display."
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        displayMode:
                          settings.displayMode === "minimal"
                            ? "full"
                            : "minimal",
                      })
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {settings.displayMode === "minimal" ? "Minimal" : "Full"}
                  </button>
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
                          settings.autoModMode === "reject"
                            ? "flag"
                            : "reject",
                      })
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {settings.autoModMode === "reject"
                      ? "Auto-reject"
                      : "Flag only"}
                  </button>
                </SettingRow>

                <div className="my-4 border-t border-white/10" />
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Account
                </p>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPwMsg(null);
                    setPwErr(null);
                    if (pwNew.length < 8) {
                      setPwErr("New password must be at least 8 characters.");
                      return;
                    }
                    if (pwNew !== pwConfirm) {
                      setPwErr("New passwords do not match.");
                      return;
                    }
                    setPwBusy(true);
                    try {
                      const res = await fetch("/api/auth/password", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          currentPassword: pwCurrent,
                          newPassword: pwNew,
                        }),
                      });
                      const d = (await res.json().catch(() => ({}))) as {
                        error?: string;
                      };
                      if (!res.ok) {
                        setPwErr(d.error || "Could not change password.");
                        return;
                      }
                      setPwCurrent("");
                      setPwNew("");
                      setPwConfirm("");
                      setPwMsg("Password updated.");
                    } catch {
                      setPwErr("Network error. Try again.");
                    } finally {
                      setPwBusy(false);
                    }
                  }}
                >
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Current password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password (min 8)"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-wave/50 focus:outline-none"
                  />
                  {pwErr ? (
                    <p className="text-xs text-rose-300">{pwErr}</p>
                  ) : null}
                  {pwMsg ? (
                    <p className="text-xs text-pulse">{pwMsg}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={pwBusy || !pwCurrent || !pwNew}
                    className="rounded-lg bg-pulse px-3 py-2 text-xs font-bold text-ink disabled:opacity-50"
                  >
                    {pwBusy ? "Saving…" : "Change password"}
                  </button>
                </form>
              </section>
            )}
          </div>
        </div>
      </main>
    </EventTheme>
  );
}

function StatChip({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface/50 px-3 py-2.5 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-0.5 truncate font-display text-sm font-semibold text-white">
        {value}
      </p>
    </div>
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
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition active:scale-90 disabled:opacity-30 ${
        danger
          ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
          : "border-white/15 text-white/70 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function FallbackReorderRow({
  track,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onJumpTop,
  onJumpBottom,
  onDelete,
}: {
  track: FallbackTrack;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onJumpTop: () => void;
  onJumpBottom: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-ink-800/40 p-2 shadow-none"
      whileDrag={{
        zIndex: 20,
        scale: 1.02,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        borderColor: "rgba(34,211,238,0.35)",
      }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border border-white/10 text-white/40 hover:bg-white/5 hover:text-white/70 active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <span className="text-xs leading-none tracking-tighter" aria-hidden>
          ⋮⋮
        </span>
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-bold text-white/40">
        {index + 1}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={track.thumbnailUrl}
        alt=""
        className="h-9 w-14 shrink-0 rounded object-cover"
        draggable={false}
      />
      <span className="min-w-0 flex-1 line-clamp-1 text-xs text-white">
        {track.title}
      </span>
      <IconBtn label="To top" disabled={index === 0} onClick={onJumpTop}>
        ⤒
      </IconBtn>
      <IconBtn label="Up" disabled={index === 0} onClick={onMoveUp}>
        ↑
      </IconBtn>
      <IconBtn
        label="Down"
        disabled={index === total - 1}
        onClick={onMoveDown}
      >
        ↓
      </IconBtn>
      <IconBtn
        label="To bottom"
        disabled={index === total - 1}
        onClick={onJumpBottom}
      >
        ⤓
      </IconBtn>
      <IconBtn label="Remove" danger onClick={onDelete}>
        ✕
      </IconBtn>
    </Reorder.Item>
  );
}
