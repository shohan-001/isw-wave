"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useDominantColor, rgb } from "@/lib/useDominantColor";
import { useSimulatedBeat } from "@/components/cinematic/useSimulatedBeat";

const CYAN_VARS = {
  ["--accent" as string]: "#22d3ee",
  ["--accent-rgb" as string]: "34 211 238",
  ["--accent-glow" as string]: "rgba(34, 211, 238, 0.45)",
};

/** Full-bleed cinematic atmosphere — thumb tint + beat bloom. Public UIs only. */
export function CinematicStage({
  artUrl,
  children,
  className = "",
}: {
  artUrl?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const accent = useDominantColor(artUrl ?? null);
  const pulse = useSimulatedBeat(artUrl ? 118 : 88);
  const bloom = 0.22 + pulse * 0.28;

  return (
    <div
      className={`relative min-h-[100dvh] w-full overflow-x-hidden bg-ink ${className}`}
      style={CYAN_VARS}
    >
      {/* Blurred artwork plane */}
      {artUrl ? (
        <motion.div
          key={artUrl}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artUrl}
            alt=""
            className="h-full w-full object-cover opacity-45 blur-[72px] scale-125"
          />
        </motion.div>
      ) : null}

      {/* Thumb / cyan radial bloom — reacts to beat */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-700"
        style={{
          background: `
            radial-gradient(65% 55% at 50% 35%, ${rgb(accent, bloom)} 0%, transparent 68%),
            radial-gradient(40% 35% at 80% 80%, ${rgb(accent, 0.12 + pulse * 0.1)} 0%, transparent 70%),
            radial-gradient(35% 30% at 15% 85%, rgba(34, 211, 238, ${0.08 + pulse * 0.06}) 0%, transparent 65%)
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/55 to-ink/90" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
