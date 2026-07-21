// Phase 1 is single-event: we use one fixed Event row with a known id so every
// API route can reference it without a lookup. The schema still keys everything
// by eventId (foreign keys), so Phase 5 multi-tenancy only needs to drop this
// constant and resolve the event per-request/subdomain instead.
export const EVENT_ID = "isw-wave-main-event";

// Cookie names.
export const SESSION_COOKIE = "isw_session";
export const ADMIN_COOKIE = "isw_admin";

// Statuses (kept as string constants to match the SQLite string columns).
export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PLAYED: "played",
} as const;

export type RequestStatus = (typeof STATUS)[keyof typeof STATUS];
