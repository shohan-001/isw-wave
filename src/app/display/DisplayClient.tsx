"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { formatDuration } from "@/lib/types";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { EqualizerBars } from "@/components/EqualizerBars";
import { WaveBackground } from "@/components/WaveBackground";
import { EventTheme } from "@/components/EventTheme";
import { useDominantColor, rgb } from "@/lib/useDominantColor";

// Projector + phone display — silent, high-contrast, responsive.
export function DisplayClient({
  requestUrl,
  accessCode,
  eventName,
  eventId,
  accentColor,
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
  const { data } = useQueuePolling(5000, { eventId });
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);

  const themeAccent = data?.accentColor ?? accentColor;
  const themeLogo = data?.logoUrl ?? logoUrl;
  const displayMode =
    (data?.displayMode ?? initialDisplayMode) === "minimal" ? "minimal" : "full";
  const isMinimal = displayMode === "minimal";

  const accent = useDominantColor(
    now ? hiRes(now.youtubeVideoId, now.thumbnailUrl) : null
  );

  const pulse = useSimulatedBeat();
  const elapsed = useElapsed(now?.id ?? null);
  const progress = now?.durationSeconds
    ? Math.min(1, elapsed / now.durationSeconds)
    : 0;

  const code = data?.accessCode ?? accessCode;
  const name = data?.eventName ?? eventName;

  return (
    <EventTheme
      accentColor={themeAccent}
      className="relative min-h-[100dvh] w-full overflow-x-hidden bg-ink"
    >
      <div
        className="pointer-events-none absolute inset-0 transition-colors duration-1000"
        style={{
          background: `radial-gradient(70% 55% at 40% 40%, ${rgb(accent, 0.38)} 0%, transparent 70%)`,
        }}
      />
      <WaveBackground color={rgb(accent, 1)} pulse={pulse} />
      <div className="absolute inset-0 bg-ink/50" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8 lg:pb-6 lg:pt-6">
        {/* Header — always aligned */}
        <header className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-3">
          {themeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={themeLogo}
              alt=""
              className="h-8 w-auto max-h-8 object-contain sm:h-9"
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-wave/20 text-wave-400 sm:h-9 sm:w-9">
              <EqualizerBars className="h-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-wave-400 sm:text-xs">
              ISW Wave
            </p>
            <p className="truncate text-sm text-white/70 sm:text-base">{name}</p>
          </div>
          {now ? (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-wave-400 sm:flex">
              <EqualizerBars className="h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                Live
              </span>
            </div>
          ) : null}
        </header>

        {/* Main stage — stacked on mobile, side-by-side on large screens */}
        <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          {/* Now playing column */}
          <section className="flex min-h-0 flex-col">
            <AnimatePresence mode="wait">
              {now ? (
                <motion.div
                  key={now.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full flex-col"
                >
                  <div className="mb-3 flex items-center justify-center gap-2 text-wave-400 sm:mb-4 sm:justify-start">
                    <EqualizerBars className="h-5 sm:h-6" />
                    <span className="font-display text-sm font-semibold uppercase tracking-[0.28em] sm:text-base">
                      Now Playing
                    </span>
                  </div>

                  <div className="relative mx-auto w-full max-w-4xl flex-1 lg:mx-0">
                    {/* Fan cards — desktop only, keep stage clean on phones */}
                    {!isMinimal && (
                      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex">
                        <AnimatePresence initial={false}>
                          {queue.slice(0, 2).map((r, i) => {
                            const depth = i + 1;
                            const dir = depth % 2 === 0 ? -1 : 1;
                            return (
                              <motion.div
                                key={r.id}
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 0.35 - depth * 0.08,
                                  scale: 0.92 - depth * 0.04,
                                  x: dir * depth * 90,
                                  y: depth * 18,
                                  rotate: dir * depth * 2.5,
                                }}
                                className="absolute aspect-video w-[78%] overflow-hidden rounded-2xl border border-white/10"
                                style={{ zIndex: 5 - depth }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={hiRes(r.youtubeVideoId, r.thumbnailUrl)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-ink/50" />
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}

                    <motion.div
                      style={{
                        zIndex: 10,
                        boxShadow: `0 0 ${40 + pulse * 50}px ${pulse * 4}px ${rgb(accent, 0.55)}`,
                      }}
                      className="relative aspect-video overflow-hidden rounded-2xl border border-white/15 sm:rounded-3xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hiRes(now.youtubeVideoId, now.thumbnailUrl)}
                        alt={now.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-ink/95 via-ink/50 to-transparent px-3 pb-3 pt-10 sm:gap-3 sm:px-5 sm:pb-4">
                        <span className="font-display text-xs font-semibold tabular-nums text-white/85 sm:text-sm">
                          {formatDuration(Math.floor(elapsed))}
                        </span>
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ backgroundColor: rgb(accent, 1) }}
                            animate={{ width: `${progress * 100}%` }}
                            transition={{ ease: "linear", duration: 0.5 }}
                          />
                        </div>
                        <span className="font-display text-xs font-semibold tabular-nums text-white/85 sm:text-sm">
                          {formatDuration(now.durationSeconds)}
                        </span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Title under hero — always readable on mobile */}
                  <div className="mt-4 text-center lg:text-left">
                    <p className="line-clamp-2 font-display text-xl font-bold text-white sm:text-2xl lg:text-3xl">
                      {now.title}
                    </p>
                    <p className="mt-1 truncate text-sm text-white/50 sm:text-base">
                      {now.channelName}
                      {now.requesterName ? (
                        <span className="text-white/35">
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
                  className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center backdrop-blur-sm sm:rounded-3xl"
                >
                  <EqualizerBars className="mb-4 h-8 text-wave-400" />
                  <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                    Nothing playing yet
                  </h1>
                  <p className="mt-3 max-w-md text-base text-white/50 sm:text-lg">
                    Scan the QR code and request the first song of the night.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Join panel — QR + code */}
          <aside className="flex shrink-0 flex-col gap-3 lg:gap-4">
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-2xl sm:p-5 lg:flex-1 lg:rounded-3xl">
              <p className="text-center font-display text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45 sm:text-xs">
                Scan to request
              </p>
              <div className="mt-3 flex justify-center">
                <QRCodeBlock url={requestUrl} compact />
              </div>
              <div className="mt-4 rounded-xl border border-white/12 bg-ink/60 px-3 py-3 text-center sm:rounded-2xl sm:px-4 sm:py-3.5">
                <p className="font-display text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
                  Event code
                </p>
                <p className="mt-1 font-display text-2xl font-bold tracking-[0.18em] text-white sm:text-3xl">
                  {code}
                </p>
              </div>
            </div>

            {/* Up next preview — desktop sidebar / mobile list */}
            {!isMinimal && (
              <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 backdrop-blur-xl lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                    Up next
                  </h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                    {queue.length}
                  </span>
                </div>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto no-scrollbar lg:max-h-none lg:h-[calc(100%-2rem)]">
                  {queue.slice(0, 6).map((r, i) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2"
                    >
                      <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-wave-400">
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-9 w-14 shrink-0 rounded-md object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium text-white">
                          {r.title}
                        </span>
                        <span className="block truncate text-xs text-white/40">
                          {r.requesterName}
                        </span>
                      </span>
                    </li>
                  ))}
                  {queue.length === 0 && (
                    <li className="py-6 text-center text-sm text-white/30">
                      Queue is empty
                    </li>
                  )}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile pull-up for more queue (full mode only) — optional detail sheet */}
        {!isMinimal && now && queue.length > 3 && (
          <div className="mt-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm text-white/55 backdrop-blur-md"
            >
              <span className="h-1 w-10 rounded-full bg-white/35" />
              <span>{sheetOpen ? "Hide full queue" : "Show full queue"}</span>
            </button>
            <AnimatePresence>
              {sheetOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-xl"
                >
                  {queue.map((r, i) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2"
                    >
                      <span className="w-5 text-center font-display text-sm font-bold text-wave-400">
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-10 w-16 rounded-md object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm text-white">
                          {r.title}
                        </span>
                        <span className="text-xs text-white/40">
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
    </EventTheme>
  );
}

function useSimulatedBeat(bpm = 120): number {
  const [pulse, setPulse] = useState(0);
  const raf = useRef<number>();
  const start = useRef<number | null>(null);
  useEffect(() => {
    const period = 60000 / bpm;
    const loop = (t: number) => {
      if (start.current === null) start.current = t;
      const phase = ((t - start.current) % period) / period;
      setPulse(Math.pow(1 - phase, 2.2));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [bpm]);
  return pulse;
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
