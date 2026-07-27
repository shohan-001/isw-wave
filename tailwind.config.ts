import type { Config } from "tailwindcss";

// wave / glow read --accent-rgb (public cinematic cyan by default;
// admin EventTheme can still override per-event accents).
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#07080c",
          800: "#0c0e14",
          700: "#12151e",
          600: "#1a1f2b",
        },
        surface: {
          DEFAULT: "#10141c",
          raised: "#161c28",
        },
        wave: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          400: "rgb(var(--accent-rgb) / 0.9)",
          600: "rgb(var(--accent-rgb) / 0.7)",
        },
        pulse: {
          DEFAULT: "#22d3ee",
          600: "#0891b2",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px var(--accent-glow)",
        "glow-lg": "0 0 80px -12px var(--accent-glow)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "equalize-1": {
          "0%,100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        "equalize-2": {
          "0%,100%": { transform: "scaleY(0.7)" },
          "40%": { transform: "scaleY(0.3)" },
          "70%": { transform: "scaleY(1)" },
        },
        "equalize-3": {
          "0%,100%": { transform: "scaleY(0.5)" },
          "30%": { transform: "scaleY(1)" },
          "60%": { transform: "scaleY(0.4)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "eq-1": "equalize-1 0.9s ease-in-out infinite",
        "eq-2": "equalize-2 1.1s ease-in-out infinite",
        "eq-3": "equalize-3 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
