import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";

// --- Signed session identifiers -------------------------------------------
//
// Phase 1 has no accounts. We identify an attendee by a random session id that
// we sign with HMAC-SHA256 (SESSION_SECRET) so the client can't forge one.
//
// The cookie value is `<id>.<signature>`. We also expose the raw id so the
// client can mirror it into localStorage — many in-app browsers (Instagram,
// WhatsApp, the phone camera) drop cookies when the mini-browser closes, so the
// request page re-syncs the cookie from localStorage on load via /api/session.
//
// NOTE: this is a best-effort mitigation, not bulletproof — some in-app
// browsers sandbox localStorage too. Good enough for a single event; Phase 2
// accounts make identity durable.

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function signSessionId(id: string): string {
  return `${id}.${sign(id)}`;
}

// Verify a `<id>.<sig>` token, returning the id if the signature matches.
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(id);
  // Constant-time compare to avoid leaking via timing.
  if (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return id;
  }
  return null;
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

// Read the current session id from the request cookie, or null if absent/invalid.
export function getSessionId(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// Cookie options: 1 year, httpOnly false so the client can mirror it into
// localStorage as the in-app-browser fallback. It's signed, so readability is
// not a security concern here.
export function sessionCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
