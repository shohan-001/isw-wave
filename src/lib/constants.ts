// Phase 1 is single-event: we use one fixed Event row with a known id so every
// API route can reference it without a lookup. The schema still keys everything
// by eventId (foreign keys), so Phase 5 multi-tenancy only needs to drop this
// constant and resolve the event per-request/subdomain instead.
export const EVENT_ID = "isw-wave-main-event";

// Cookie names. Phase 2 replaces the anonymous session + shared-password admin
// cookies with a single signed auth cookie carrying the logged-in user's id.
export const AUTH_COOKIE = "isw_auth";

// Minimum duration (seconds) for a YouTube result to be requestable. Filters
// out Shorts/teasers (0:06, 0:15…) that aren't usable as queue songs. Override
// with MIN_SONG_SECONDS in the environment.
export const MIN_SONG_SECONDS = Number(process.env.MIN_SONG_SECONDS) || 60;

// Statuses (kept as string constants to match the SQLite string columns).
export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PLAYED: "played",
} as const;

export type RequestStatus = (typeof STATUS)[keyof typeof STATUS];
