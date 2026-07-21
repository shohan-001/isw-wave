import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { AUTH_COOKIE } from "./constants";

// --- Phase 2 auth: real accounts, signed-cookie sessions ------------------
//
// One username/password flow for both attendees and admins (isAdmin decides
// routing). We deliberately did NOT pull in next-auth (built for OAuth
// providers — heavy for a single credentials flow) or a JWT lib (we already
// HMAC-sign values into cookies). Instead the auth cookie is `<userId>.<sig>`
// where sig = HMAC-SHA256(SESSION_SECRET, userId) — a signed-claims token in
// spirit, verified server-side, with the user then loaded from the DB.
//
// Passwords use bcryptjs (pure JS) rather than the native `bcrypt` so there's
// no binary to recompile on Vercel — the same reason the app uses the LibSQL
// adapter. bcrypt already salts per-hash; no separate salt column needed.

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const BCRYPT_ROUNDS = 10;

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

// --- Password hashing ---
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- Signed auth token (`<userId>.<sig>`) ---
function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function signAuthToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

// Verify a token, returning the userId if the signature matches (else null).
export function verifyAuthToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(id);
  if (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return id;
  }
  return null;
}

// The auth cookie is httpOnly (unlike the Phase-1 session cookie there's no
// need for the client to read it — identity is durable in the DB now).
export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

// --- Current-user resolution ---
// Reads + verifies the cookie, then loads the user. Returns null if the cookie
// is missing/forged or the user no longer exists.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  const userId = verifyAuthToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, isAdmin: true },
  });
  return user;
}

// Convenience guards for API routes.
export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}
