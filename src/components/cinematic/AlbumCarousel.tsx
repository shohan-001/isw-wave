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

/** 3D-ish album fan — larger center cover for projector readability. */
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
      className="relative mx-auto flex h-[min(62vw,420px)] w-full max-w-2xl items-center justify-center sm:h-[440px] lg:h-[500px] xl:h-[540px]"
      style={{ perspective: 1000 }}
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
                opacity: 0.38 - depth * 0.06,
                scale: 0.72 - depth * 0.04,
                x: dir * (depth * 88 + 36),
                y: depth * 16,
                rotateY: dir * -16,
                rotateZ: dir * 3.5,
              }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
              className="absolute aspect-square w-[54%] overflow-hidden rounded-[1.75rem] sm:w-[48%]"
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
        className="relative z-10 aspect-square w-[84%] overflow-hidden rounded-[2rem] sm:w-[76%] sm:rounded-[2.5rem] lg:w-[72%]"
        style={{
          boxShadow: `0 0 ${40 + pulse * 52}px ${pulse * 7}px ${rgb(accent, 0.5)}, 0 36px 72px -24px rgba(0,0,0,0.8)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artSrc(now)}
          alt={now.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
      </motion.div>
    </div>
  );
}
