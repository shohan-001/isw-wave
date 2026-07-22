// Theme helpers (safe for client + server). Dark-background contrast checks
 // keep custom accents readable on the near-black UI.

export const DEFAULT_ACCENT = "#e0338f";
export const INK_BG = { r: 11, g: 10, b: 18 }; // #0b0a12

export type DisplayMode = "minimal" | "full";

export type EventTheme = {
  accentColor: string;
  logoUrl: string;
  displayMode: DisplayMode;
  eventName: string;
};

export function normalizeHex(raw: string): string | null {
  const s = raw.trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio of accent against the dark ink background. */
export function contrastOnInk(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const L1 = relLuminance(rgb);
  const L2 = relLuminance(INK_BG);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

 /** Target ≥ 3:1 for large UI accents on dark; flag below that. */
export function accentContrastOk(hex: string): boolean {
  return contrastOnInk(hex) >= 3;
}

export function accentRgbCss(hex: string): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT)!;
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

export function themeStyleVars(accentHex: string): React.CSSProperties {
  const hex = normalizeHex(accentHex) || DEFAULT_ACCENT;
  const rgb = accentRgbCss(hex);
  return {
    ["--accent" as string]: hex,
    ["--accent-rgb" as string]: rgb,
    ["--accent-glow" as string]: `rgba(${rgb.replace(/ /g, ", ")}, 0.55)`,
  };
}
