// Seeded default event id (kept for seed script + local fixtures). Runtime
 // code resolves the event from the session (admin/participant) or from an
 // access code query param — do not hard-code this in API routes.
export const EVENT_ID = "isw-wave-main-event";

// Cookie names. One signed cookie for both admin and participant sessions.
export const AUTH_COOKIE = "isw_auth";
export const OWNER_COOKIE = "isw_owner";

 // Client-side device fingerprint (localStorage). Bound to one display name.
export const DEVICE_ID_KEY = "isw_device_id";

 // Minimum duration (seconds) for a YouTube result to be requestable.
export const MIN_SONG_SECONDS = Number(process.env.MIN_SONG_SECONDS) || 60;

export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PLAYED: "played",
} as const;

export type RequestStatus = (typeof STATUS)[keyof typeof STATUS];
