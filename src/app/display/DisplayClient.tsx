"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useQueuePolling } from "@/lib/useQueuePolling";
import { formatDuration } from "@/lib/types";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { EqualizerBars } from "@/components/EqualizerBars";

// Big, high-contrast projector screen. Viewed from a distance across a room, so
// type is large and the now-playing hero dominates. Silent by design — no
// audio, no player embed here (the admin device owns venue audio).
export function DisplayClient({ requestUrl }: { requestUrl: string }) {
  const { data } = useQueuePolling(5000);
  const now = data?.nowPlaying ?? null;
  const queue = data?.queue ?? [];

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Ambient blurred album art behind the hero. */}
      <AnimatePresence>
        {now && (
          <motion.div
            key={now.youtubeVideoId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url(${hiRes(now.youtubeVideoId, now.thumbnailUrl)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(60px) saturate(1.4)",
            }}
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-ink/70" />

      <div className="relative z-10 flex min-h-screen flex-col gap-6 p-8 xl:flex-row xl:gap-10 xl:p-12">
        {/* LEFT: Now playing hero */}
        <section className="flex flex-1 flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <span className="font-display text-lg font-medium uppercase tracking-[0.25em] text-wave-400">
              ISW Wave
            </span>
            <span className="text-white/30">·</span>
            <span className="text-lg text-white/50">{data?.eventName ?? ""}</span>
          </div>

          <AnimatePresence mode="wait">
            {now ? (
              <motion.div
                key={now.id}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.98 }}
                transition={{ type: "spring", damping: 26, stiffness: 220 }}
              >
                <div className="flex items-center gap-3 text-wave-400">
                  <EqualizerBars className="h-6" />
                  <span className="font-display text-xl font-semibold uppercase tracking-[0.3em]">
                    Now Playing
                  </span>
                </div>

                <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 shadow-glow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hiRes(now.youtubeVideoId, now.thumbnailUrl)}
                    alt={now.title}
                    className="aspect-video w-full max-w-2xl object-cover"
                  />
                </div>

                <h1 className="mt-8 max-w-3xl font-display text-5xl font-bold leading-[1.05] text-white xl:text-6xl">
                  {now.title}
                </h1>
                <p className="mt-4 text-2xl text-white/50">{now.channelName}</p>
                <p className="mt-6 flex items-center gap-3 text-xl">
                  <span className="rounded-full bg-wave/20 px-4 py-1.5 font-semibold text-wave-400">
                    {now.requesterName}
                  </span>
                  <span className="text-white/40">
                    requested · {formatDuration(now.durationSeconds)}
                  </span>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-xl"
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
        </section>

        {/* RIGHT: Queue + QR */}
        <aside className="flex w-full flex-col gap-8 xl:w-[26rem]">
          <div className="flex justify-center xl:justify-end">
            <QRCodeBlock url={requestUrl} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/10 bg-ink-800/60 p-6 backdrop-blur">
            <h2 className="mb-4 font-display text-xl font-semibold uppercase tracking-[0.2em] text-white/70">
              Up Next
              <span className="ml-2 text-white/30">{queue.length}</span>
            </h2>
            <ul className="no-scrollbar flex flex-col gap-3 overflow-y-auto">
              <AnimatePresence initial={false}>
                {queue.map((r, i) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ type: "spring", damping: 28, stiffness: 260 }}
                    className="flex items-center gap-3"
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
                      <span className="line-clamp-1 text-base font-medium text-white">
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
          </div>
        </aside>
      </div>
    </div>
  );
}

// YouTube exposes a higher-res thumbnail at a predictable URL. Fall back to the
// medium thumbnail we stored if the hqdefault isn't available.
function hiRes(videoId: string, fallback: string): string {
  return videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : fallback;
}
