"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { formatDuration, type PublicRequest } from "@/lib/types";
import { useDominantColor } from "@/lib/useDominantColor";
import { CinematicStage } from "@/components/cinematic/CinematicStage";
import { GlassPanel } from "@/components/cinematic/GlassPanel";
import { AlbumCarousel } from "@/components/cinematic/AlbumCarousel";
import { ArcProgress } from "@/components/cinematic/ArcProgress";
import { useSimulatedBeat } from "@/components/cinematic/useSimulatedBeat";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { EqualizerBars } from "@/components/EqualizerBars";
import { BrandMark } from "@/components/BrandMark";

// Projector + phone display — cinematic glass HMI, thumb-tinted atmosphere.
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
  const { data } = useQueuePolling(5000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];

  const themeLogo = data?.logoUrl ?? logoUrl;
  const displayMode =
    (data?.displayMode ?? initialDisplayMode) === "minimal" ? "minimal" : "full";
  const isMinimal = displayMode === "minimal";

  const artUrl = now ? hiRes(now.youtubeVideoId, now.thumbnailUrl) : null;
  const accent = useDominantColor(artUrl);
  const pulse = useSimulatedBeat(now ? 118 : 88);
  const elapsed = useElapsed(now?.id ?? null);
  const progress = now?.durationSeconds
    ? Math.min(1, elapsed / now.durationSeconds)
    : 0;

  const code = data?.accessCode ?? accessCode;
  const name = data?.eventName ?? eventName;
  const nextUp = queue[0] ?? null;
  const restQueue = queue.slice(1, 8);

  return (
    <CinematicStage artUrl={artUrl}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1680px] flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-10 lg:pb-7 lg:pt-6">
        <header className="flex shrink-0 items-center gap-3 sm:gap-4">
          {themeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={themeLogo}
              alt=""
              className="h-9 w-auto max-h-9 object-contain sm:h-10"
            />
          ) : (
            <BrandMark size={36} showWordmark={false} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-pulse sm:text-xs">
              ISW Wave
            </p>
            <p className="truncate text-sm text-white/55 sm:text-base">{name}</p>
          </div>
          {now ? (
            <div className="hidden items-center gap-2 text-pulse sm:flex">
              <EqualizerBars className="h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                Live
              </span>
            </div>
          ) : null}
        </header>

        {/* Stage + QR — Up Next lives full-width below for readability */}
        <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <section className="flex min-h-0 flex-col justify-center">
            <AnimatePresence mode="wait">
              {now ? (
                <motion.div
                  key={now.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="mb-1 flex items-center gap-2 text-pulse sm:mb-2">
                    <EqualizerBars className="h-4 sm:h-5" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.32em] sm:text-sm">
                      {data?.nowPlayingIsFallback ? "Fallback" : "Now Playing"}
                    </span>
                  </div>

                  <AlbumCarousel
                    now={now}
                    upNext={isMinimal ? [] : queue.slice(0, 2)}
                    accent={accent}
                    pulse={pulse}
                  />

                  <div className="mt-1 w-full max-w-lg px-2 sm:mt-2">
                    <ArcProgress
                      progress={progress}
                      elapsed={elapsed}
                      duration={now.durationSeconds}
                      accent={accent}
                      pulse={pulse}
                    />
                  </div>

                  <div className="mt-3 max-w-3xl px-2 text-center sm:mt-4">
                    <p className="line-clamp-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl xl:text-5xl">
                      {now.title}
                    </p>
                    <p className="mt-2 text-sm text-white/45 sm:text-base">
                      {now.channelName}
                      {data?.nowPlayingIsFallback ? (
                        <span className="text-white/30"> · fallback playlist</span>
                      ) : now.requesterName ? (
                        <span className="text-white/30">
                          {" "}
                          · requested by {now.requesterName}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="cinema-float flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
                >
                  <GlassPanel className="max-w-lg px-8 py-12 sm:px-12 sm:py-14">
                    <EqualizerBars className="mx-auto mb-5 h-8 text-pulse" />
                    <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                      Nothing playing yet
                    </h1>
                    <p className="mt-3 text-base text-white/45 sm:text-lg">
                      Scan the code and request the first song of the night.
                    </p>
                  </GlassPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <aside className="flex shrink-0 flex-col justify-center">
            <GlassPanel className="cinema-float p-4 sm:p-5">
              <p className="text-center font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40 sm:text-xs">
                Scan to request
              </p>
              <div className="mt-3 flex justify-center">
                <QRCodeBlock url={requestUrl} compact cinematic />
              </div>
              <div className="mt-4 text-center">
                <p className="font-display text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                  Event code
                </p>
                <p className="mt-1 font-display text-2xl font-bold tracking-[0.18em] text-white sm:text-3xl">
                  {code}
                </p>
              </div>
            </GlassPanel>
          </aside>
        </div>

        {/* Full-width Up Next — titles + votes readable on projector */}
        {!isMinimal && (
          <div className="mt-4 shrink-0 lg:mt-5">
            <UpNextBoard next={nextUp} rest={restQueue} total={queue.length} />
          </div>
        )}
      </div>
    </CinematicStage>
  );
}

function UpNextBoard({
  next,
  rest,
  total,
}: {
  next: PublicRequest | null;
  rest: PublicRequest[];
  total: number;
}) {
  return (
    <GlassPanel className="overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-pulse sm:text-base">
            Up next
          </h2>
          <p className="mt-0.5 text-xs text-white/35 sm:text-sm">
            Crowd favorites rise with votes — scan to join in
          </p>
        </div>
        <span className="font-display text-lg font-bold tabular-nums text-white/50 sm:text-xl">
          {total}
        </span>
      </div>

      {!next ? (
        <p className="py-8 text-center text-base text-white/30 sm:text-lg">
          Queue is empty — be the first to request
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
          {/* Featured next track */}
          <motion.div
            key={next.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex min-w-0 flex-1 items-center gap-4 rounded-2xl bg-white/[0.06] p-3 sm:gap-5 sm:p-4 lg:max-w-[48%]"
          >
            <span className="absolute left-3 top-3 rounded-full bg-pulse px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-ink sm:left-4 sm:top-4">
              Next
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hiRes(next.youtubeVideoId, next.thumbnailUrl)}
              alt=""
              className="h-24 w-24 shrink-0 rounded-2xl object-cover shadow-xl sm:h-28 sm:w-28 lg:h-32 lg:w-32"
            />
            <div className="min-w-0 flex-1 pt-5 sm:pt-4">
              <p className="line-clamp-2 font-display text-lg font-bold leading-snug text-white sm:text-xl lg:text-2xl">
                {next.title}
              </p>
              <p className="mt-1 truncate text-sm text-white/45">
                {next.requesterName}
                {next.channelName ? ` · ${next.channelName}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <VoteChip count={next.voteCount} hot />
                <span className="text-xs tabular-nums text-white/35">
                  {formatDuration(next.durationSeconds)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Rest of queue */}
          <ul className="flex min-w-0 flex-1 gap-3 overflow-x-auto no-scrollbar pb-1 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-visible lg:pb-0">
            <AnimatePresence initial={false}>
              {rest.map((r, i) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex w-[min(78vw,280px)] shrink-0 items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 sm:w-auto sm:p-3"
                >
                  <span className="w-6 shrink-0 text-center font-display text-base font-bold text-pulse">
                    {i + 2}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-md sm:h-16 sm:w-16"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-white sm:text-[15px]">
                      {r.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/40">
                      {r.requesterName}
                    </p>
                  </div>
                  <VoteChip count={r.voteCount} />
                </motion.li>
              ))}
            </AnimatePresence>
            {rest.length === 0 && (
              <li className="flex items-center justify-center rounded-2xl bg-white/[0.03] px-4 py-6 text-sm text-white/30 lg:col-span-2 xl:col-span-3">
                Only one song waiting — keep the requests coming
              </li>
            )}
          </ul>
        </div>
      )}
    </GlassPanel>
  );
}

function VoteChip({ count, hot = false }: { count: number; hot?: boolean }) {
  const n = Math.max(0, count);
  return (
    <motion.span
      key={n}
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      className={`inline-flex shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 ${
        hot
          ? "bg-pulse/20 text-pulse shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)]"
          : "bg-white/[0.08] text-white/80"
      }`}
      title={`${n} vote${n === 1 ? "" : "s"}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
        ▲
      </span>
      <span className="font-display text-base font-bold tabular-nums leading-none sm:text-lg">
        {n}
      </span>
    </motion.span>
  );
}

function useElapsed(songId: string | null): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const raf = useRef<number>();
  useEffect(() => {
    startRef.current = null;
    setElapsed(0);
    const loop = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      setElapsed((t - startRef.current) / 1000);
      raf.current = requestAnimationFrame(loop);
    };
    if (songId) raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [songId]);
  return elapsed;
}

function hiRes(videoId: string, fallback: string): string {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : fallback;
}
