import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "./constants";

// --- Single-admin password auth (Phase 1) ---------------------------------
//
// One shared password via ADMIN_PASSWORD. On successful login we set a signed,
// httpOnly cookie whose value is HMAC(SESSION_SECRET, "admin"). Phase 2 replaces
// this with real multi-user admin accounts.

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

function adminToken(): string {
  return crypto.createHmac("sha256", SECRET).update("admin").digest("hex");
}

// Timing-safe password check.
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function adminCookieValue(): string {
  return adminToken();
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h — long enough for one event
  };
}

// True if the request carries a valid admin cookie.
export function isAdmin(): boolean {
  const val = cookies().get(ADMIN_COOKIE)?.value;
  if (!val) return false;
  const expected = adminToken();
  return (
    val.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expected))
  );
}
