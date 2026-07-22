"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDuration, type AuthUser, type PublicRequest } from "@/lib/types";
import type { SearchResult } from "@/lib/youtube";
import { StatusBadge } from "@/components/StatusBadge";

type Phase = "idle" | "searching" | "results";

export function RequestClient({
  eventName,
  user,
}: {
  eventName: string;
  user: Extract<AuthUser, { role: "participant" }>;
}) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [mine, setMine] = useState<PublicRequest[]>([]);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);

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

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Poll my-requests every 5s so status (pending→approved/played) and the
  // remaining-slots count stay fresh as songs play out.
  // TODO(Phase 3): replace polling with a WebSocket subscription.
  useEffect(() => {
    const t = setInterval(loadMine, 5000);
    return () => clearInterval(t);
  }, [loadMine]);

  // --- Search: 500ms debounce AND explicit submit both gate the API call. ---
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

    // Optimistic: show it as pending immediately.
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
        // Roll back the optimistic entry and surface the error.
        setMine((m) => m.filter((r) => r.id !== optimistic.id));
        setUsed((u) => Math.max(0, u - 1));
        setSubmitError(data.error || "Could not submit request.");
        setSubmitting(false);
        return;
      }
      setJustSubmitted(true);
      setSelected(null);
      setSubmitting(false);
      await loadMine();
      setTimeout(() => setJustSubmitted(false), 2200);
    } catch {
      setMine((m) => m.filter((r) => r.id !== optimistic.id));
      setUsed((u) => Math.max(0, u - 1));
      setSubmitError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-6">
      {/* Branding + account */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WaveMark />
            <span className="font-display text-sm font-medium uppercase tracking-[0.2em] text-wave-400">
              ISW Wave
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/45">{user.displayName}</span>
            <button
              onClick={logout}
              className="rounded-full border border-white/10 px-2.5 py-1 font-medium text-white/50 transition active:scale-95"
            >
              Leave
            </button>
          </div>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white">
          {eventName}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Search a song and send it to the stage.
        </p>
      </header>

      {/* Quota line */}
      <QuotaLine used={used} limit={limit} />

      {/* Search */}
      <form onSubmit={onSubmitSearch} className="sticky top-3 z-10 mt-4">
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-surface/80 p-2 shadow-glow backdrop-blur">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search for a song…"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-white placeholder:text-white/35 focus:outline-none"
            aria-label="Search for a song"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.94 }}
            disabled={query.trim().length < 2 || phase === "searching"}
            className="rounded-xl bg-wave px-4 py-2 text-sm font-semibold text-white shadow-glow transition disabled:opacity-40"
          >
            {phase === "searching" ? "…" : "Search"}
          </motion.button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-white/30">
          Showing full-length tracks only — short clips are filtered out.
        </p>
      </form>

      {/* Results / skeletons */}
      <section className="mt-3 flex-1">
        {phase === "searching" && <ResultSkeletons />}

        {phase === "results" && searchError && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
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
                      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                        isSelected
                          ? "border-wave bg-wave/10 shadow-glow"
                          : "border-white/10 bg-ink-700/70 hover:border-wave/40 hover:bg-ink-600/60"
                      }`}
                    >
                      <Thumb src={r.thumbnailUrl} alt={r.title} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-white">
                          {r.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/50">
                          {r.channelName}
                          {r.durationSeconds
                            ? ` · ${formatDuration(r.durationSeconds)}`
                            : ""}
                        </span>
                      </span>
                      {isSelected && (
                        <span className="shrink-0 rounded-full bg-wave px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
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

      {/* My requests */}
      {mine.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 px-1 font-display text-sm font-semibold uppercase tracking-wide text-white/40">
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
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface/40 p-2.5"
                >
                  <Thumb src={r.thumbnailUrl} alt={r.title} small />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium text-white">
                      {r.title}
                    </span>
                    <span className="mt-1 block">
                      <StatusBadge status={r.status} />
                    </span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {/* Confirm sheet */}
      <ConfirmSheet
        selected={selected}
        displayName={user.displayName}
        submitting={submitting}
        atLimit={atLimit}
        error={submitError}
        onClose={() => setSelected(null)}
        onConfirm={submitRequest}
      />

      {/* Success burst */}
      <AnimatePresence>{justSubmitted && <SuccessBurst />}</AnimatePresence>
    </main>
  );
}

// --- Pieces ---------------------------------------------------------------

function QuotaLine({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const remaining = Math.max(0, limit - used);
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface/50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">
          {used} of {limit} requests used
        </p>
        <p className="mt-0.5 text-xs text-white/45">
          {remaining > 0
            ? `${remaining} more slot${remaining === 1 ? "" : "s"} — frees up as your songs play.`
            : "Limit reached — a slot frees up when one of your songs plays."}
        </p>
      </div>
      {/* Dot meter of the allowance. */}
      <div className="flex shrink-0 items-center gap-1.5">
        {Array.from({ length: limit }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < used ? "bg-wave" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function WaveMark() {
  return (
    <span className="inline-flex h-6 items-end gap-[3px] text-wave">
      <span className="w-[3px] rounded-full bg-current animate-eq-1" style={{ height: "60%" }} />
      <span className="w-[3px] rounded-full bg-current animate-eq-2" style={{ height: "100%" }} />
      <span className="w-[3px] rounded-full bg-current animate-eq-3" style={{ height: "45%" }} />
    </span>
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
      className={`relative shrink-0 overflow-hidden rounded-lg bg-white/5 ${
        small ? "h-11 w-11" : "h-14 w-20"
      }`}
    >
      {/* Plain img: thumbnails are remote YouTube URLs; avoids next/image config. */}
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
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-700/70 p-2.5"
        >
          <span className="skeleton h-14 w-20 rounded-lg" />
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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl border-t border-white/10 bg-ink-800 p-5 pb-8 shadow-glow-lg"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex gap-3">
              <Thumb src={selected.thumbnailUrl} alt={selected.title} />
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

            <p className="mt-5 rounded-xl border border-white/10 bg-surface/60 px-4 py-3 text-sm text-white/70">
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
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/70 transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onConfirm}
                disabled={submitting}
                className="flex-[1.6] rounded-xl bg-wave py-3 text-sm font-bold text-white shadow-glow transition disabled:opacity-60"
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
        className="flex flex-col items-center gap-3 rounded-3xl border border-wave/30 bg-ink-800/90 px-8 py-7 shadow-glow-lg backdrop-blur"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-wave text-2xl">
          ✓
        </span>
        <span className="font-display text-lg font-bold text-white">
          Request sent!
        </span>
        <span className="text-xs text-white/50">Watch for it in the queue.</span>
      </motion.div>
    </motion.div>
  );
}
