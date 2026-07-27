"use client";

import { useEffect, useState } from "react";

// Samples a thumbnail image and returns its dominant color as an [r,g,b] tuple.
// Used on the display page to tint the ambient glow behind the now-playing card
// so the whole screen picks up the mood of the current track's artwork.
//
// YouTube's i.ytimg.com serves thumbnails with permissive CORS, so a canvas
// draw stays untainted and getImageData works. If a particular host ever taints
// the canvas we swallow the error and fall back to cinematic cyan.

const FALLBACK: [number, number, number] = [34, 211, 238]; // pulse cyan

export function useDominantColor(src: string | null): [number, number, number] {
  const [color, setColor] = useState<[number, number, number]>(FALLBACK);

  useEffect(() => {
    if (!src) {
      setColor(FALLBACK);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24; // tiny sample — fast and averages out noise
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 125) continue; // skip transparent
          // Skip near-grayscale pixels so a colored accent wins over black bars.
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          if (max - min < 18 && max < 200) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) {
          setColor(FALLBACK);
          return;
        }
        setColor([
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count),
        ]);
      } catch {
        setColor(FALLBACK);
      }
    };
    img.onerror = () => !cancelled && setColor(FALLBACK);
    return () => {
      cancelled = true;
    };
  }, [src]);

  return color;
}

export function rgb([r, g, b]: [number, number, number], alpha = 1): string {
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
