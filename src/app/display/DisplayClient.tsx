"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { formatDuration, type PublicRequest } from "@/lib/types";
import { useDominantColor } from "@/lib/useDominantColor";
import { CinematicStage } from "@/components/cinematic/CinematicStage";
import { GlassPanel } from "@/components/cinematic/GlassPanel";
import { AlbumCarousel } from "@/components/cinematic/AlbumCarousel";
import { BrandMark } from "@/components/BrandMark";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { EqualizerBars } from "@/components/EqualizerBars";

/** Projector-first: everything fits in one viewport — no scroll. */
export function DisplayClient({
  requestUrl,
  accessCode,
  eventName,
  eventId,
  accentColor: _accentColor,
  logoUrl,
  displayMode: initialDisplayMode,
}: {
  requestUrl: string;
  accessCode: string;
  eventName: string;
  eventId: string;
  accentColor: string;
  logoUrl: string;
  displayMode: "minimal" | "full";
}) {
  void _accentColor;
  // Poll often enough to re-anchor the synced timeline after refresh.
  const { data } = useQueuePolling(2000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];

  const themeLogo = data?.logoUrl ?? logoUrl;
  const displayMode =
    (data?.displayMode ?? initialDisplayMode) === "minimal" ? "minimal" : "full";
  const isMinimal = displayMode === "minimal";

  const artUrl = now ? hiRes(now.youtubeVideoId, now.thumbnailUrl) : null;
  const accent = useDominantColor(artUrl);
  const elapsed = useSyncedElapsed(data?.playback ?? null, now?.id ?? null);
  const progress = now?.durationSeconds
    ? Math.min(1, elapsed / now.durationSeconds)
    : 0;

  const code = data?.accessCode ?? accessCode;
  const name = data?.eventName ?? eventName;
  const nextUp = queue[0] ?? null;
  const restQueue = queue.slice(1, 5);

  return (
    <CinematicStage artUrl={artUrl} viewportLock>
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5">
        <header className="flex shrink-0 items-center gap-3">
          {themeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={themeLogo}
              alt=""
              className="h-8 w-auto max-h-8 object-contain sm:h-9"
            />
          ) : (
            <BrandMark size={32} showWordmark={false} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-pulse sm:text-xs">
              ISW Wave
            </p>
            <p className="truncate text-xs text-white/50 sm:text-sm">{name}</p>
          </div>
          {now ? (
            <div className="hidden items-center gap-2 text-pulse sm:flex">
              <EqualizerBars className="h-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                Live
              </span>
            </div>
          ) : null}
        </header>

        {/* Main row: capped 16:9 art + QR — title lives below so it never clips */}
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 content-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
          <section className="flex min-h-0 flex-col">
            <AnimatePresence mode="wait">
              {now ? (
                <motion.div
                  key={now.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-0 flex-col"
                >
                  <div className="mb-1.5 flex items-center gap-2 text-pulse">
                    <EqualizerBars className="h-3.5" />
                    <span className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] sm:text-xs">
                      {data?.nowPlayingIsFallback ? "Fallback" : "Now Playing"}
                    </span>
                  </div>

                  {/* Cap height so progress + title stay on-screen */}
                  <div className="flex w-full justify-center">
                    <div className="aspect-video h-[min(36vh,400px)] w-auto max-w-full overflow-hidden rounded-2xl sm:h-[min(40vh,440px)] sm:rounded-3xl lg:h-[min(42vh,480px)]">
                      <AlbumCarousel now={now} accent={accent} />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center py-8"
                >
                  <GlassPanel className="max-w-md px-8 py-10 text-center">
                    <EqualizerBars className="mx-auto mb-4 h-7 text-pulse" />
                    <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                      Nothing playing yet
                    </h1>
                    <p className="mt-2 text-sm text-white/45">
                      Scan the code and request the first song.
                    </p>
                  </GlassPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <aside className="flex shrink-0 self-start lg:self-stretch">
            <GlassPanel className="flex w-full flex-col items-center justify-center p-3 sm:p-4 lg:max-h-[min(42vh,480px)] lg:p-5">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Scan to request
              </p>
              <div className="mt-2 flex flex-1 items-center justify-center sm:mt-3">
                <QRCodeBlock url={requestUrl} compact cinematic />
              </div>
              <div className="mt-2 text-center sm:mt-3">
                <p className="font-display text-[9px] font-medium uppercase tracking-[0.22em] text-white/35">
                  Event code
                </p>
                <p className="mt-0.5 font-display text-xl font-bold tracking-[0.16em] text-white sm:text-2xl lg:text-3xl">
                  {code}
                </p>
              </div>
            </GlassPanel>
          </aside>
        </div>

        {/* Dedicated title band — always visible above Up Next */}
        {now ? (
          <div className="mt-3 shrink-0 sm:mt-4">
            <LinearProgress
              progress={progress}
              elapsed={elapsed}
              duration={now.durationSeconds}
            />
            <h1 className="mt-2.5 line-clamp-2 font-display text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl lg:text-4xl">
              {now.title}
            </h1>
            <p className="mt-1 truncate text-sm text-white/65 sm:text-base">
              {now.channelName}
              {data?.nowPlayingIsFallback
                ? " · fallback"
                : now.requesterName
                ? ` · requested by ${now.requesterName}`
                : ""}
            </p>
          </div>
        ) : null}

        {!isMinimal && (
          <div className="mt-3 shrink-0">
            <UpNextStrip next={nextUp} rest={restQueue} total={queue.length} />
          </div>
        )}
      </div>
    </CinematicStage>
  );
}

function LinearProgress({
  progress,
  elapsed,
  duration,
}: {
  progress: number;
  elapsed: number;
  duration: number;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 font-display text-[11px] tabular-nums text-white/50 sm:w-12 sm:text-xs">
        {formatDuration(Math.floor(elapsed))}
      </span>
      <div className="relative h-[3px] flex-1 overflow-visible rounded-full bg-white/15">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-pulse"
          style={{
            width: `${p * 100}%`,
            boxShadow: "0 0 12px rgba(34,211,238,0.45)",
          }}
        />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-pulse"
          style={{ left: `calc(${p * 100}% - 5px)` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-display text-[11px] tabular-nums text-white/50 sm:w-12 sm:text-xs">
        {formatDuration(duration)}
      </span>
    </div>
  );
}

function UpNextStrip({
  next,
  rest,
  total,
}: {
  next: PublicRequest | null;
  rest: PublicRequest[];
  total: number;
}) {
  return (
    <GlassPanel className="px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-pulse sm:text-xs">
          Up next
        </h2>
        <span className="font-display text-sm font-bold tabular-nums text-white/45">
          {total}
        </span>
      </div>

      {!next ? (
        <p className="py-3 text-center text-sm text-white/30">
          Queue is empty — scan to request
        </p>
      ) : (
        <ul className="flex gap-2 overflow-hidden sm:gap-3">
          <li className="flex min-w-0 flex-[1.35] items-center gap-2.5 rounded-xl bg-white/[0.06] p-2 sm:gap-3 sm:p-2.5">
            <span className="shrink-0 rounded-md bg-pulse px-1.5 py-0.5 font-display text-[9px] font-bold uppercase text-ink">
              Next
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hiRes(next.youtubeVideoId, next.thumbnailUrl)}
              alt=""
              className="h-12 w-20 shrink-0 rounded-lg object-cover sm:h-14 sm:w-24"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-white sm:text-base">
                {next.title}
              </p>
              <p className="truncate text-[11px] text-white/40">
                {next.requesterName}
              </p>
            </div>
            <VoteChip count={next.voteCount} hot />
          </li>

          {rest.map((r, i) => (
            <li
              key={r.id}
              className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.04] p-2 sm:flex lg:gap-2.5"
            >
              <span className="w-4 shrink-0 text-center font-display text-xs font-bold text-pulse">
                {i + 2}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.thumbnailUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm">
                  {r.title}
                </p>
                <p className="truncate text-[10px] text-white/35">
                  {r.requesterName}
                </p>
              </div>
              <VoteChip count={r.voteCount} />
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function VoteChip({ count, hot = false }: { count: number; hot?: boolean }) {
  const n = Math.max(0, count);
  return (
    <span
      className={`inline-flex shrink-0 flex-col items-center rounded-lg px-2 py-1 ${
        hot ? "bg-pulse/20 text-pulse" : "bg-white/[0.08] text-white/75"
      }`}
      title={`${n} votes`}
    >
      <span className="text-[9px] font-bold leading-none">▲</span>
      <span className="font-display text-sm font-bold tabular-nums leading-none">
        {n}
      </span>
    </span>
  );
}

/** Interpolate admin YouTube position between queue polls / after refresh. */
function useSyncedElapsed(
  playback: {
    positionSec: number;
    playing: boolean;
    updatedAt: string | null;
  } | null,
  songId: string | null
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!songId || !playback) {
      setElapsed(0);
      return;
    }

    const base = playback.positionSec || 0;
    const updatedMs = playback.updatedAt
      ? Date.parse(playback.updatedAt)
      : Date.now();

    const compute = () => {
      if (!playback.playing) return base;
      const drift = Math.max(0, (Date.now() - updatedMs) / 1000);
      return base + drift;
    };

    setElapsed(compute());
    if (!playback.playing) return;

    const id = setInterval(() => setElapsed(compute()), 250);
    return () => clearInterval(id);
  }, [
    songId,
    playback?.positionSec,
    playback?.playing,
    playback?.updatedAt,
  ]);

  return elapsed;
}

function hiRes(videoId: string, fallback: string): string {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : fallback;
}
