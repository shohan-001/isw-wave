"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useDominantColor, rgb } from "@/lib/useDominantColor";

const CYAN_VARS = {
  ["--accent" as string]: "#22d3ee",
  ["--accent-rgb" as string]: "34 211 238",
  ["--accent-glow" as string]: "rgba(34, 211, 238, 0.35)",
};

/** Calm cinematic atmosphere — soft art wash, no pulsing bloom. */
export function CinematicStage({
  artUrl,
  children,
  className = "",
  /** Lock to one viewport (hall display). Omit for scrollable guest pages. */
  viewportLock = false,
}: {
  artUrl?: string | null;
  children: ReactNode;
  className?: string;
  viewportLock?: boolean;
}) {
  const accent = useDominantColor(artUrl ?? null);

  return (
    <div
      className={`relative w-full overflow-x-hidden bg-ink ${
        viewportLock ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      } ${className}`}
      style={CYAN_VARS}
    >
      {artUrl ? (
        <motion.div
          key={artUrl}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9 }}
          className="pointer-events-none absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-[0.18] blur-[80px]"
          />
        </motion.div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(55% 45% at 42% 32%, ${rgb(accent, 0.14)} 0%, transparent 70%),
            radial-gradient(40% 35% at 88% 78%, rgba(34, 211, 238, 0.06) 0%, transparent 65%)
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/70 to-ink" />

      <div className={`relative z-10 ${viewportLock ? "h-full" : ""}`}>
        {children}
      </div>
    </div>
  );
}
