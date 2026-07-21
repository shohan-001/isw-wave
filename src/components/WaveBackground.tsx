"use client";

import { motion } from "framer-motion";

// Flowing "wave" ribbons that glow behind the hero — a bright, horizontal band
// echoing the brand name. Color is passed in (the now-playing thumbnail's
// dominant color) so the whole scene shifts hue as songs change. `pulse` (0..1)
// nudges the intensity on a simulated beat so the band breathes with a tempo.
export function WaveBackground({
  color = "rgb(224,51,143)",
  pulse = 0,
}: {
  color?: string;
  pulse?: number;
}) {
  const glow = 0.55 + pulse * 0.35;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <svg
        className="h-[70%] w-[130%]"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="wave-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="25%" stopColor={color} stopOpacity="1" />
            <stop offset="75%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft wide halo (heavy blur) */}
        <motion.path
          fill="none"
          stroke="url(#wave-fade)"
          strokeWidth={46}
          strokeLinecap="round"
          style={{ filter: "blur(38px)" }}
          animate={{
            d: [
              "M -50 200 C 200 90, 400 310, 600 200 S 1000 90, 1250 200",
              "M -50 200 C 200 300, 400 100, 600 210 S 1000 300, 1250 200",
              "M -50 200 C 200 90, 400 310, 600 200 S 1000 90, 1250 200",
            ],
            opacity: glow,
          }}
          transition={{
            d: { duration: 11, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.25 },
          }}
        />

        {/* Crisp bright core line */}
        <motion.path
          fill="none"
          stroke="url(#wave-fade)"
          strokeWidth={7}
          strokeLinecap="round"
          style={{ filter: "blur(2px)" }}
          animate={{
            d: [
              "M -50 200 C 200 110, 400 300, 600 200 S 1000 100, 1250 200",
              "M -50 200 C 200 290, 400 110, 600 205 S 1000 300, 1250 200",
              "M -50 200 C 200 110, 400 300, 600 200 S 1000 100, 1250 200",
            ],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          opacity={0.9}
        />

        {/* Second thinner ribbon offset for depth */}
        <motion.path
          fill="none"
          stroke="url(#wave-fade)"
          strokeWidth={4}
          strokeLinecap="round"
          style={{ filter: "blur(1px)" }}
          animate={{
            d: [
              "M -50 210 C 250 150, 450 260, 650 200 S 1050 150, 1250 210",
              "M -50 210 C 250 250, 450 150, 650 215 S 1050 250, 1250 210",
              "M -50 210 C 250 150, 450 260, 650 200 S 1050 150, 1250 210",
            ],
          }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          opacity={0.5}
        />
      </svg>
    </div>
  );
}
