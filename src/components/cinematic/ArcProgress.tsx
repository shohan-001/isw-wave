"use client";

import { motion } from "framer-motion";
import { formatDuration } from "@/lib/types";
import { rgb } from "@/lib/useDominantColor";

/** Curved progress arc under the album hero (desktop); linear bar under `sm`. */
export function ArcProgress({
  progress,
  elapsed,
  duration,
  accent,
  pulse = 0,
}: {
  progress: number;
  elapsed: number;
  duration: number;
  accent: [number, number, number];
  pulse?: number;
}) {
  const p = Math.max(0, Math.min(1, progress));
  // Arc path: open bottom semicircle-ish curve
  const w = 320;
  const h = 56;
  const r = 150;
  const cx = w / 2;
  const cy = 8;
  const startAngle = Math.PI * 0.85;
  const endAngle = Math.PI * 0.15;
  const sweep = startAngle - endAngle;

  function pt(t: number) {
    const a = startAngle - sweep * t;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) * 0.55 };
  }

  const s = pt(0);
  const e = pt(1);
  const track = `M ${s.x} ${s.y} A ${r} ${r * 0.55} 0 0 1 ${e.x} ${e.y}`;

  const mid = pt(p);
  const activeEnd = mid;
  const active = `M ${s.x} ${s.y} A ${r} ${r * 0.55} 0 0 1 ${activeEnd.x} ${activeEnd.y}`;

  return (
    <div className="w-full">
      {/* Arc — md+ */}
      <div className="relative mx-auto hidden w-full max-w-sm md:block">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-14 w-full overflow-visible"
          aria-hidden
        >
          <path
            d={track}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {p > 0.002 ? (
            <motion.path
              d={active}
              fill="none"
              stroke={rgb(accent, 1)}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 ${6 + pulse * 10}px ${rgb(accent, 0.7)})`,
              }}
            />
          ) : null}
          <circle
            cx={mid.x}
            cy={mid.y}
            r={4 + pulse * 1.5}
            fill={rgb(accent, 1)}
            style={{
              filter: `drop-shadow(0 0 ${8 + pulse * 8}px ${rgb(accent, 0.85)})`,
            }}
          />
        </svg>
        <div className="mt-1 flex justify-between px-6 font-display text-xs tabular-nums text-white/45">
          <span>{formatDuration(Math.floor(elapsed))}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Linear — mobile */}
      <div className="flex items-center gap-3 md:hidden">
        <span className="font-display text-[11px] tabular-nums text-white/50">
          {formatDuration(Math.floor(elapsed))}
        </span>
        <div className="relative h-[2px] flex-1 overflow-visible rounded-full bg-white/15">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${p * 100}%`,
              backgroundColor: rgb(accent, 1),
              boxShadow: `0 0 ${8 + pulse * 12}px ${rgb(accent, 0.65)}`,
            }}
          />
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${p * 100}% - 5px)`,
              backgroundColor: rgb(accent, 1),
              boxShadow: `0 0 ${6 + pulse * 8}px ${rgb(accent, 0.8)}`,
            }}
          />
        </div>
        <span className="font-display text-[11px] tabular-nums text-white/50">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
