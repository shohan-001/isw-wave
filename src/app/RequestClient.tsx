"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDuration, type AuthUser, type PublicRequest } from "@/lib/types";
import type { SearchResult } from "@/lib/youtube";
import { StatusBadge } from "@/components/StatusBadge";
import { CinematicStage } from "@/components/cinematic/CinematicStage";
import { GlassPanel } from "@/components/cinematic/GlassPanel";
import { BrandMark } from "@/components/BrandMark";
import { useQueuePolling } from "@/lib/useQueuePolling";
import {
  isClientRealtimeConfigured,
  useEventRealtime,
} from "@/lib/useEventRealtime";

type Phase = "idle" | "searching" | "results";

export function RequestClient({
  eventName,
  accentColor: _accentColor,
  logoUrl,
  user,
}: {
  eventName: string;
  accentColor: string;
  logoUrl: string;
  user: Extract<AuthUser, { role: "participant" }>;
}) {
  void _accentColor; // public UI ignores organizer pink
  const { data: queueData } = useQueuePolling(8000, { eventId: user.eventId });
  const stageArt = queueData?.nowPlaying
    ? queueData.nowPlaying.youtubeVideoId
      ? `https://i.ytimg.com/vi/${queueData.nowPlaying.youtubeVideoId}/hqdefault.jpg`
      : queueData.nowPlaying.thumbnailUrl
    : null;

  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [mine, setMine] = useState<PublicRequest[]>([]);
  const [crowd, setCrowd] = useState<PublicRequest[]>([]);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queueSongs = crowd.filter((r) => r.status === "approved");
  const pendingSongs = crowd.filter((r) => r.status === "pending");

  const loadMine = useCallback(async () => {
    const res = await fetch("/api/requests?mine=1", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        requests: PublicRequest[];
        used: number;
        limit: number;
      };
      setMine(data.requests);
      setUsed(data.used);
      setLimit(data.limit);
    }
  }, []);

  const loadCrowd = useCallback(async () => {
    const res = await fetch("/api/requests?crowd=1", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { requests: PublicRequest[] };
      setCrowd(data.requests);
    }
  }, []);

  useEffect(() => {
    loadMine();
    loadCrowd();
  }, [loadMine, loadCrowd]);

  useEffect(() => {
    const ms = isClientRealtimeConfigured() ? 15000 : 4000;
    const t = setInterval(() => {
      void loadMine();
      void loadCrowd();
    }, ms);
    return () => clearInterval(t);
  }, [loadMine, loadCrowd]);

  useEventRealtime(user.eventId, {
    "requests:update": () => {
      void loadMine();
      void loadCrowd();
    },
    "pending:update": () => void loadCrowd(),
    "queue:update": () => {
      void loadCrowd();
      void loadMine();
    },
  });

  function focusSearch() {
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus();
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setPhase("searching");
    setSearchError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Search failed.");
        setPhase("results");
        return;
      }
      setResults(data.results as SearchResult[]);
      setPhase("results");
    } catch {
      setSearchError("Network error. Try again.");
      setPhase("results");
    }
  }, []);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 500);
  };

  const atLimit = limit > 0 && used >= limit;

  async function submitRequest() {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);

    const optimistic: PublicRequest = {
      id: `optimistic-${selected.youtubeVideoId}`,
      youtubeVideoId: selected.youtubeVideoId,
      title: selected.title,
      thumbnailUrl: selected.thumbnailUrl,
      durationSeconds: selected.durationSeconds,
      channelName: selected.channelName,
      requesterName: user.displayName,
      status: "pending",
      queuePosition: null,
      createdAt: new Date().toISOString(),
      voteCount: 0,
      flagged: false,
      flagReason: "",
    };
    setMine((m) => [optimistic, ...m]);
    setUsed((u) => u + 1);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          youtubeVideoId: selected.youtubeVideoId,
          title: selected.title,
          thumbnailUrl: selected.thumbnailUrl,
          durationSeconds: selected.durationSeconds,
          channelName: selected.channelName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMine((m) => m.filter((r) => r.id !== optimistic.id));
        setUsed((u) => Math.max(0, u - 1));
        setSubmitError(data.error || "Could not submit request.");
        setSubmitting(false);
        return;
      }
      setJustSubmitted(true);
      setSelected(null);
      setSubmitting(false);
      await Promise.all([loadMine(), loadCrowd()]);
      setTimeout(() => setJustSubmitted(false), 2200);
    } catch {
      setMine((m) => m.filter((r) => r.id !== optimistic.id));
      setUsed((u) => Math.max(0, u - 1));
      setSubmitError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  async function toggleVote(requestId: string) {
    setVoteBusy(requestId);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          request: PublicRequest;
          iVoted: boolean;
        };
        setCrowd((list) =>
          list
            .map((r) =>
              r.id === requestId
                ? { ...data.request, iVoted: data.iVoted }
                : r
            )
            .sort((a, b) => b.voteCount - a.voteCount)
        );
      }
    } finally {
      setVoteBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <CinematicStage artUrl={stageArt}>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-32 pt-6 sm:px-5">
        <header className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 max-h-[40px] w-auto object-contain"
                />
              ) : (
                <BrandMark size={28} showWordmark={false} />
              )}
              <span className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-pulse">
                ISW Wave
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              <span className="truncate text-white/40">{user.displayName}</span>
              <button
                onClick={logout}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 font-medium text-white/50 transition active:scale-95"
              >
                Leave
              </button>
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white">
            {eventName}
          </h1>
          <p className="mt-1.5 text-sm text-white/45">
            Upvote the queue or request a song for the crowd.
          </p>
          {queueData?.nowPlaying ? (
            <p className="mt-3 truncate text-xs text-pulse/80">
              Now playing · {queueData.nowPlaying.title}
            </p>
          ) : null}
        </header>

        <QuotaLine used={used} limit={limit} />

        {/* Sticky request CTA — always on the first screen */}
        <div className="sticky top-2 z-20 mt-4">
          <button
            type="button"
            onClick={focusSearch}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pulse px-4 py-3.5 text-sm font-bold text-ink shadow-[0_0_28px_-4px_rgba(34,211,238,0.55)] transition active:scale-[0.98]"
          >
            Request a song
          </button>
        </div>

        {/* Live queue — upvote to bump play order */}
        <section className="mt-6">
          <h2 className="mb-1 px-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Up next{" "}
            <span className="text-white/25">{queueSongs.length}</span>
          </h2>
          <p className="mb-3 px-1 text-xs text-white/35">
            Tap ▲ to boost songs you want — highest votes play next.
          </p>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {queueSongs.map((r, i) => (
                <VoteRow
                  key={r.id}
                  request={r}
                  rank={i + 1}
                  busy={voteBusy === r.id}
                  onVote={() => toggleVote(r.id)}
                  badge={i === 0 ? "Next" : undefined}
                />
              ))}
            </AnimatePresence>
            {queueSongs.length === 0 && (
              <li className="py-4 text-center text-sm text-white/30">
                Queue is empty — request the first track.
              </li>
            )}
          </ul>
        </section>

        <form
          id="request-search"
          onSubmit={onSubmitSearch}
          className="mt-6 scroll-mt-24"
        >
          <GlassPanel className="flex gap-2 rounded-2xl p-2 shadow-glow">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search for a song…"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:outline-none"
              aria-label="Search for a song"
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.94 }}
              disabled={query.trim().length < 2 || phase === "searching"}
              className="rounded-xl bg-pulse px-4 py-2 text-sm font-semibold text-ink shadow-[0_0_24px_-4px_rgba(34,211,238,0.55)] transition disabled:opacity-40"
            >
              {phase === "searching" ? "…" : "Search"}
            </motion.button>
          </GlassPanel>
          <p className="mt-2 px-1 text-[11px] text-white/28">
            Showing full-length tracks only — short clips are filtered out.
          </p>
        </form>

        <section className="mt-4 flex-1">
          {phase === "searching" && <ResultSkeletons />}

          {phase === "results" && searchError && (
            <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchError}
            </p>
          )}

          {phase === "results" && !searchError && results.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-white/40">
              No full-length tracks found. Try a different search.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {phase === "results" &&
                results.map((r) => {
                  const isSelected =
                    selected?.youtubeVideoId === r.youtubeVideoId;
                  return (
                    <motion.li
                      key={r.youtubeVideoId}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.button
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setSelected(r);
                          setSubmitError(null);
                        }}
                        aria-pressed={isSelected}
                        className={`glass-edge flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                          isSelected
                            ? "bg-pulse/10 shadow-[0_0_32px_-8px_rgba(34,211,238,0.45)]"
                            : "hover:bg-white/[0.06]"
                        }`}
                      >
                        <Thumb
                          src={hiResThumb(r.youtubeVideoId, r.thumbnailUrl)}
                          alt={r.title}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium text-white">
                            {r.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-white/45">
                            {r.channelName}
                            {r.durationSeconds
                              ? ` · ${formatDuration(r.durationSeconds)}`
                              : ""}
                          </span>
                        </span>
                        {isSelected && (
                          <span className="shrink-0 rounded-full bg-pulse px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
                            Selected
                          </span>
                        )}
                      </motion.button>
                    </motion.li>
                  );
                })}
            </AnimatePresence>
          </ul>
        </section>

        {pendingSongs.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 px-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Awaiting approval{" "}
              <span className="text-white/25">{pendingSongs.length}</span>
            </h2>
            <p className="mb-3 px-1 text-xs text-white/35">
              Upvote to help the DJ prioritize — does not auto-approve.
            </p>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {pendingSongs.map((r) => (
                  <VoteRow
                    key={r.id}
                    request={r}
                    busy={voteBusy === r.id}
                    onVote={() => toggleVote(r.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}

        {mine.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 px-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Your requests
            </h2>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {mine.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="glass-edge flex items-center gap-3 rounded-2xl p-2.5"
                  >
                    <Thumb
                      src={hiResThumb(r.youtubeVideoId, r.thumbnailUrl)}
                      alt={r.title}
                      small
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-white">
                        {r.title}
                      </span>
                      <span className="mt-1 block">
                        <StatusBadge status={r.status} />
                        {r.flagged && (
                          <span className="ml-2 text-[10px] font-semibold uppercase text-amber-300">
                            Flagged
                          </span>
                        )}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}

        {/* Fixed bottom request bar — always reachable without hunting */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-ink/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-lg gap-2">
            <button
              type="button"
              onClick={focusSearch}
              className="flex-1 rounded-xl bg-pulse py-3.5 text-sm font-bold text-ink shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)]"
            >
              Request a song
            </button>
          </div>
        </div>

        <ConfirmSheet
          selected={selected}
          displayName={user.displayName}
          submitting={submitting}
          atLimit={atLimit}
          error={submitError}
          onClose={() => setSelected(null)}
          onConfirm={submitRequest}
        />

        <AnimatePresence>{justSubmitted && <SuccessBurst />}</AnimatePresence>
      </main>
    </CinematicStage>
  );
}

function VoteRow({
  request: r,
  rank,
  busy,
  onVote,
  badge,
}: {
  request: PublicRequest;
  rank?: number;
  busy: boolean;
  onVote: () => void;
  badge?: string;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="glass-edge flex items-center gap-3 rounded-2xl p-2.5"
    >
      {badge ? (
        <span className="shrink-0 rounded-md bg-pulse px-1.5 py-0.5 font-display text-[9px] font-bold uppercase text-ink">
          {badge}
        </span>
      ) : rank != null ? (
        <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-pulse">
          {rank}
        </span>
      ) : null}
      <Thumb
        src={hiResThumb(r.youtubeVideoId, r.thumbnailUrl)}
        alt={r.title}
        small
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm font-medium text-white">
          {r.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-white/40">
          {r.requesterName}
          {r.flagged ? " · flagged" : ""}
        </span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onVote}
        className={`flex flex-col items-center rounded-xl px-2.5 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
          r.iVoted
            ? "bg-pulse/20 text-pulse"
            : "bg-white/[0.06] text-white/45 hover:text-pulse"
        }`}
      >
        <span>▲</span>
        <span>{r.voteCount}</span>
      </button>
    </motion.li>
  );
}

function hiResThumb(videoId: string, fallback: string): string {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : fallback;
}

function QuotaLine({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const remaining = Math.max(0, limit - used);
  return (
    <GlassPanel className="flex items-center justify-between rounded-2xl px-4 py-3.5">
      <div>
        <p className="text-sm font-semibold text-white">
          {used} of {limit} requests used
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          {remaining > 0
            ? `${remaining} more slot${remaining === 1 ? "" : "s"} — frees up as your songs play.`
            : "Limit reached — a slot frees up when one of your songs plays."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {Array.from({ length: limit }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < used ? "bg-pulse" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

function Thumb({
  src,
  alt,
  small = false,
}: {
  src: string;
  alt: string;
  small?: boolean;
}) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-md ${
        small ? "h-11 w-11" : "h-14 w-14"
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function ResultSkeletons() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="glass-edge flex items-center gap-3 rounded-2xl p-2.5"
        >
          <span className="skeleton h-14 w-14 rounded-xl" />
          <span className="flex-1">
            <span className="skeleton mb-2 block h-3.5 w-3/4 rounded" />
            <span className="skeleton block h-3 w-1/3 rounded" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ConfirmSheet({
  selected,
  displayName,
  submitting,
  atLimit,
  error,
  onClose,
  onConfirm,
}: {
  selected: SearchResult | null;
  displayName: string;
  submitting: boolean;
  atLimit: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {selected && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="glass-edge fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-[2rem] p-5 pb-8 shadow-glow-lg"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex gap-3">
              <Thumb
                src={hiResThumb(
                  selected.youtubeVideoId,
                  selected.thumbnailUrl
                )}
                alt={selected.title}
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-white">
                  {selected.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/45">
                  {selected.channelName}
                  {selected.durationSeconds
                    ? ` · ${formatDuration(selected.durationSeconds)}`
                    : ""}
                </p>
              </div>
            </div>

            <p className="mt-5 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/65">
              Requesting as{" "}
              <span className="font-semibold text-white">{displayName}</span>
            </p>

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            {atLimit && !error && (
              <p className="mt-3 text-sm text-amber-300/90">
                You&apos;re at your request limit. This will fail until one of
                your songs plays.
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-white/[0.06] py-3 text-sm font-semibold text-white/65 transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onConfirm}
                disabled={submitting}
                className="flex-[1.6] rounded-xl bg-pulse py-3 text-sm font-bold text-ink shadow-[0_0_28px_-4px_rgba(34,211,238,0.55)] transition disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Request this song"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SuccessBurst() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.4, opacity: 0 }}
        transition={{ type: "spring", damping: 12, stiffness: 200 }}
        className="glass-edge flex flex-col items-center gap-3 rounded-3xl px-8 py-7 shadow-glow-lg"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pulse text-2xl text-ink">
          ✓
        </span>
        <span className="font-display text-lg font-bold text-white">
          Request sent!
        </span>
        <span className="text-xs text-white/45">Watch for it in the queue.</span>
      </motion.div>
    </motion.div>
  );
}
