import type { Config } from "tailwindcss";

// ISW Wave palette — a nightlife/event aesthetic:
//   ink      : near-black violet backgrounds (dim room friendly)
//   surface  : slightly lifted panels
//   wave     : electric magenta→violet accent (primary action / brand)
//   pulse    : cyan secondary accent (used sparingly for highlights)
// Chosen deliberately to avoid the default indigo-on-white SaaS look.
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
          DEFAULT: "#0b0a12",
          800: "#12101d",
          700: "#1a1728",
          600: "#241f36",
        },
        surface: {
          DEFAULT: "#16131f",
          raised: "#1f1a2e",
        },
        wave: {
          DEFAULT: "#e0338f", // electric magenta
          400: "#f45cae",
          600: "#b81f74",
        },
        pulse: {
          DEFAULT: "#22d3ee", // cyan
          600: "#0891b2",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(224, 51, 143, 0.55)",
        "glow-lg": "0 0 80px -12px rgba(224, 51, 143, 0.6)",
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
