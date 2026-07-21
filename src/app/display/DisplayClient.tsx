"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { formatDuration } from "@/lib/types";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { EqualizerBars } from "@/components/EqualizerBars";
import { WaveBackground } from "@/components/WaveBackground";
import { useDominantColor, rgb } from "@/lib/useDominantColor";

// Big, high-contrast projector screen. Viewed from across a room, so type is
// large and the now-playing hero dominates. Silent by design — no audio, no
// player embed here (the admin device owns venue audio). Because there is no
// audio stream on this device, the "beat" pulse and elapsed timeline are
// simulated locally (real playback position is a Phase 3 WebSocket concern).
export function DisplayClient({ requestUrl }: { requestUrl: string }) {
  const { data } = useQueuePolling(5000);
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);

  // Tint the whole scene (glow + waves) with the current artwork's color.
  const accent = useDominantColor(
    now ? hiRes(now.youtubeVideoId, now.thumbnailUrl) : null
  );

  const pulse = useSimulatedBeat();
  const elapsed = useElapsed(now?.id ?? null);
  const progress = now?.durationSeconds
    ? Math.min(1, elapsed / now.durationSeconds)
    : 0;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-ink">
      {/* Ambient color-adaptive glow. */}
      <div
        className="pointer-events-none absolute inset-0 transition-colors duration-1000"
        style={{
          background: `radial-gradient(65% 55% at 42% 45%, ${rgb(accent, 0.4)} 0%, transparent 72%)`,
        }}
      />
      {/* Glowing wave band behind the cards. */}
      <WaveBackground color={rgb(accent, 1)} pulse={pulse} />
      <div className="absolute inset-0 bg-ink/45" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-10 pt-8">
        <span className="font-display text-xl font-medium uppercase tracking-[0.25em] text-wave-400">
          ISW Wave
        </span>
        <span className="text-white/30">·</span>
        <span className="text-xl text-white/50">{data?.eventName ?? ""}</span>
      </div>

      {/* QR — top right */}
      <div className="absolute right-10 top-8 z-20">
        <QRCodeBlock url={requestUrl} />
      </div>

      {/* CENTER STAGE: fanned card stack. Bottom padding leaves room for the
          collapsed sheet so the hero is never cropped. */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-8 pb-52 pt-4">
        <AnimatePresence mode="wait">
          {now ? (
            <motion.div
              key="stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-col items-center"
            >
              <div className="mb-6 flex items-center gap-3 text-wave-400">
                <EqualizerBars className="h-7" />
                <span className="font-display text-2xl font-semibold uppercase tracking-[0.3em]">
                  Now Playing
                </span>
              </div>

              {/* Card stack: queued tracks fan out behind the big hero card. */}
              <div className="relative flex h-[clamp(360px,56vh,720px)] w-full max-w-5xl items-center justify-center">
                <AnimatePresence initial={false}>
                  {queue.slice(0, 3).map((r, i) => {
                    const depth = i + 1;
                    const dir = depth % 2 === 0 ? -1 : 1;
                    return (
                      <motion.div
                        key={r.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: 0.5 - depth * 0.11,
                          scale: 1 - depth * 0.08,
                          x: dir * depth * 130,
                          y: depth * 30,
                          rotate: dir * depth * 3.5,
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", damping: 24, stiffness: 180 }}
                        style={{ zIndex: 10 - depth }}
                        className="absolute aspect-video w-[74%] overflow-hidden rounded-3xl border border-white/10 shadow-glow-lg"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={hiRes(r.youtubeVideoId, r.thumbnailUrl)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-ink/45" />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Hero card — big, front and center, pulsing glow on the beat. */}
                <motion.div
                  key={now.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 26, stiffness: 220 }}
                  style={{
                    zIndex: 20,
                    boxShadow: `0 0 ${70 + pulse * 70}px ${pulse * 6}px ${rgb(accent, 0.65)}`,
                  }}
                  className="relative aspect-video w-[86%] overflow-hidden rounded-[2rem] border border-white/15"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hiRes(now.youtubeVideoId, now.thumbnailUrl)}
                    alt={now.title}
                    className="h-full w-full object-cover"
                  />

                  {/* Timeline bar across the bottom of the hero card. */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-ink/90 to-transparent px-6 pb-4 pt-10">
                    <span className="font-display text-sm font-semibold tabular-nums text-white/80">
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
                    <span className="font-display text-sm font-semibold tabular-nums text-white/80">
                      {formatDuration(now.durationSeconds)}
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-xl text-center"
            >
              <h1 className="font-display text-5xl font-bold text-white xl:text-6xl">
                Nothing playing yet
              </h1>
              <p className="mt-4 text-2xl text-white/50">
                Scan the code and request the first song of the night.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM SHEET: glass bar with the song name; click handle or drag up for
          full details + queue. Collapsed height clears the hero above it. */}
      {now && (
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.y < -40) setSheetOpen(true);
            else if (info.offset.y > 40) setSheetOpen(false);
          }}
          animate={{ height: sheetOpen ? "clamp(360px, 56vh, 680px)" : 140 }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
          className="absolute inset-x-0 bottom-0 z-30 cursor-grab overflow-hidden rounded-t-[2rem] border-t border-white/15 bg-white/[0.07] backdrop-blur-2xl active:cursor-grabbing"
          style={{ boxShadow: `0 -20px 90px -30px ${rgb(accent, 0.85)}` }}
        >
          {/* Grab handle — click toggles too. */}
          <button
            onClick={() => setSheetOpen((v) => !v)}
            className="mx-auto mt-3 flex h-6 w-full max-w-[200px] items-center justify-center"
            aria-label="Toggle details"
          >
            <span className="h-1.5 w-16 rounded-full bg-white/40" />
          </button>

          {/* Collapsed bar — always visible */}
          <div className="flex items-center gap-4 px-10 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hiRes(now.youtubeVideoId, now.thumbnailUrl)}
              alt=""
              className="h-16 w-28 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-display text-2xl font-bold text-white">
                {now.title}
              </p>
              <p className="truncate text-lg text-white/55">{now.channelName}</p>
            </div>
            <div className="flex items-center gap-4">
              {!sheetOpen && (
                <span className="hidden text-base text-white/40 sm:inline">
                  Pull up for details
                </span>
              )}
              <EqualizerBars className="h-7 text-wave-400" />
            </div>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {sheetOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-10 pb-8"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-6 pt-2 text-lg">
                  <span
                    className="rounded-full px-4 py-1.5 font-semibold text-white"
                    style={{ backgroundColor: rgb(accent, 0.4) }}
                  >
                    {now.requesterName}
                  </span>
                  <span className="text-white/45">
                    requested · {formatDuration(now.durationSeconds)}
                  </span>
                </div>

                <h3 className="mt-6 font-display text-lg font-semibold uppercase tracking-[0.2em] text-white/70">
                  Up Next
                  <span className="ml-2 text-white/30">{queue.length}</span>
                </h3>
                <ul className="no-scrollbar mt-4 flex max-h-[30vh] flex-col gap-3 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {queue.map((r, i) => (
                      <motion.li
                        key={r.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", damping: 28, stiffness: 260 }}
                        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                      >
                        <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-wave-400">
                          {i + 1}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.thumbnailUrl}
                          alt=""
                          className="h-12 w-20 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-lg font-medium text-white">
                            {r.title}
                          </span>
                          <span className="truncate text-sm text-white/45">
                            {r.requesterName}
                          </span>
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {queue.length === 0 && (
                    <li className="py-6 text-center text-white/30">
                      Queue is empty — request a song!
                    </li>
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// A gentle simulated "beat": a value that swings 0..1 on a musical-ish tempo so
// the glow/waves breathe. Not tied to real audio (this device is silent) — it's
// a visual heartbeat at ~120bpm.
function useSimulatedBeat(bpm = 120): number {
  const [pulse, setPulse] = useState(0);
  const raf = useRef<number>();
  const start = useRef<number | null>(null);
  useEffect(() => {
    const period = 60000 / bpm; // ms per beat
    const loop = (t: number) => {
      if (start.current === null) start.current = t;
      const phase = ((t - start.current) % period) / period; // 0..1
      // Sharp attack, soft decay — feels like a kick.
      const env = Math.pow(1 - phase, 2.2);
      setPulse(env);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [bpm]);
  return pulse;
}

// Approximate elapsed seconds for the current song. Resets whenever the song id
// changes. This is a local clock, not the admin player's true position — good
// enough for a visual timeline until Phase 3 broadcasts real playback state.
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

// YouTube exposes a higher-res thumbnail at a predictable URL. Fall back to the
// medium thumbnail we stored if the hqdefault isn't available.
function hiRes(videoId: string, fallback: string): string {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : fallback;
}
