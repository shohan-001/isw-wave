"use client";

import { motion } from "framer-motion";
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

/** Full 16:9 now-playing frame — entire YouTube thumb visible. */
export function AlbumCarousel({
  now,
  accent,
}: {
  now: CarouselTrack;
  upNext?: CarouselTrack[];
  accent: [number, number, number];
  pulse?: number;
}) {
  return (
    <motion.div
      key={now.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      className="relative h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl"
      style={{
        boxShadow: `0 0 40px -12px ${rgb(accent, 0.35)}, 0 24px 48px -20px rgba(0,0,0,0.7)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artSrc(now)}
        alt={now.title}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />
    </motion.div>
  );
}
