/** Public marketing / footer links for the live app. */
export const SITE = {
  name: "ISW Wave",
  author: "Isharaka Shohan",
  portfolioUrl: "https://isharaka.dev",
  githubUrl: "https://github.com/shohan-001/isw-wave",
  contactEmail: "isharakashohan2003@gmail.com",
  appUrl: "https://isw-wave.isharaka.dev",
} as const;

/**
 * Hero headline candidates — swap `ACTIVE_HEADLINE` when you pick one.
 * 1. Let the crowd control the playlist.
 * 2. Scan. Request. Hear it on the big screen.
 * 3. Live song requests — no app required.
 */
export const HEADLINE_OPTIONS = [
  "Let the crowd control the playlist.",
  "Scan. Request. Hear it on the big screen.",
  "Live song requests — no app required.",
] as const;

export const ACTIVE_HEADLINE = HEADLINE_OPTIONS[1];
