"use client";

import { AnimatePresence, motion } from "framer-motion";
import { rgb } from "@/lib/useDominantColor";

export type CarouselTrack = {
  id: string;
  title: string;
  thumbnailUrl: string;
  youtubeVideoId: string;
};

function artSrc(t: CarouselTrack): string {
  return t.youtubeVideoId
    ? `https://i.ytimg.com/vi/${t.youtubeVideoId}/hqdefault.jpg`
    : t.thumbnailUrl;
}

/** 3D-ish album fan — now playing center, up-next angled behind. */
export function AlbumCarousel({
  now,
  upNext,
  accent,
  pulse = 0,
}: {
  now: CarouselTrack;
  upNext: CarouselTrack[];
  accent: [number, number, number];
  pulse?: number;
}) {
  const sides = upNext.slice(0, 2);

  return (
    <div
      className="relative mx-auto flex h-[min(52vw,340px)] w-full max-w-lg items-center justify-center sm:h-[360px] lg:h-[400px]"
      style={{ perspective: 900 }}
    >
      <AnimatePresence initial={false}>
        {sides.map((t, i) => {
          const depth = i + 1;
          const dir = depth % 2 === 0 ? -1 : 1;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{
                opacity: 0.4 - depth * 0.08,
                scale: 0.78 - depth * 0.04,
                x: dir * (depth * 72 + 28),
                y: depth * 14,
                rotateY: dir * -18,
                rotateZ: dir * 4,
              }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
              className="absolute aspect-square w-[58%] overflow-hidden rounded-[1.75rem] sm:w-[52%]"
              style={{
                zIndex: 5 - depth,
                transformStyle: "preserve-3d",
                boxShadow: "0 24px 48px -20px rgba(0,0,0,0.7)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artSrc(t)}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-ink/45" />
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.div
        key={now.id}
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="relative z-10 aspect-square w-[72%] overflow-hidden rounded-[2rem] sm:w-[64%] sm:rounded-[2.25rem]"
        style={{
          boxShadow: `0 0 ${36 + pulse * 48}px ${pulse * 6}px ${rgb(accent, 0.45)}, 0 32px 64px -24px rgba(0,0,0,0.75)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artSrc(now)}
          alt={now.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
      </motion.div>
    </div>
  );
}
