"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
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
  void _accentColor; // public UI ignores organizer pink — fixed cinematic cyan
  const { data } = useQueuePolling(5000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);

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

  return (
    <CinematicStage artUrl={artUrl}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-10 lg:pb-8 lg:pt-6">
        {/* Header — borderless */}
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

        <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          {/* Stage */}
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
                  <div className="mb-2 flex items-center gap-2 text-pulse">
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

                  <div className="mt-2 w-full max-w-md px-2 sm:mt-3">
                    <ArcProgress
                      progress={progress}
                      elapsed={elapsed}
                      duration={now.durationSeconds}
                      accent={accent}
                      pulse={pulse}
                    />
                  </div>

                  <div className="mt-4 max-w-2xl px-2 text-center sm:mt-5">
                    <p className="line-clamp-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                      {now.title}
                    </p>
                    <p className="mt-2 truncate text-sm text-white/45 sm:text-base">
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
                  className="cinema-float flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
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

          {/* Join dock */}
          <aside className="flex shrink-0 flex-col gap-4">
            <GlassPanel className="cinema-float p-5 sm:p-6 lg:flex-1">
              <p className="text-center font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40 sm:text-xs">
                Scan to request
              </p>
              <div className="mt-4 flex justify-center">
                <QRCodeBlock url={requestUrl} compact cinematic />
              </div>
              <div className="mt-5 text-center">
                <p className="font-display text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                  Event code
                </p>
                <p className="mt-1.5 font-display text-3xl font-bold tracking-[0.2em] text-white sm:text-4xl">
                  {code}
                </p>
              </div>
            </GlassPanel>

            {!isMinimal && (
              <GlassPanel className="p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                    Up next
                  </h2>
                  <span className="font-display text-xs tabular-nums text-pulse/80">
                    {queue.length}
                  </span>
                </div>
                <ul className="mt-3 max-h-48 space-y-2.5 overflow-y-auto no-scrollbar lg:max-h-none lg:h-[calc(100%-1.75rem)]">
                  {queue.slice(0, 6).map((r, i) => (
                    <li key={r.id} className="flex items-center gap-3 py-1">
                      <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-pulse">
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-lg"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium text-white">
                          {r.title}
                        </span>
                        <span className="block truncate text-xs text-white/35">
                          {r.requesterName}
                        </span>
                      </span>
                    </li>
                  ))}
                  {queue.length === 0 && (
                    <li className="py-8 text-center text-sm text-white/30">
                      Queue is empty
                    </li>
                  )}
                </ul>
              </GlassPanel>
            )}
          </aside>
        </div>

        {!isMinimal && now && queue.length > 3 && (
          <div className="mt-4 lg:hidden">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              className="glass-edge flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm text-white/50"
            >
              <span className="h-1 w-10 rounded-full bg-white/30" />
              <span>{sheetOpen ? "Hide full queue" : "Show full queue"}</span>
            </button>
            <AnimatePresence>
              {sheetOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="glass-edge mt-2 max-h-64 space-y-2 overflow-y-auto rounded-2xl p-3"
                >
                  {queue.map((r, i) => (
                    <li key={r.id} className="flex items-center gap-3 p-2">
                      <span className="w-5 text-center font-display text-sm font-bold text-pulse">
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm text-white">
                          {r.title}
                        </span>
                        <span className="text-xs text-white/35">
                          {r.requesterName}
                        </span>
                      </span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </CinematicStage>
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
