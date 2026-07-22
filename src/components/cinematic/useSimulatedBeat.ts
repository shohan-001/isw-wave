"use client";

import { useEffect, useRef, useState } from "react";

/** Soft simulated beat pulse 0→1 for cinematic glow (not real audio FFT). */
export function useSimulatedBeat(bpm = 120): number {
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
