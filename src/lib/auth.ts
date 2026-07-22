import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { AUTH_COOKIE } from "./constants";

// --- Phase 2 auth -----------------------------------------------------------
//
 // Two session kinds share one signed cookie (`isw_auth`):
 //   a.<userId>.<sig>          — admin (password login)
 //   p.<participantId>.<sig>   — attendee (name + event access code)
 //
 // Attendees never create email/password accounts. Admins are seeded Users.
 // Device lock: a deviceId may only ever use one displayName (see /api/auth/join).

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const BCRYPT_ROUNDS = 10;

export type AdminSession = {
  role: "admin";
  id: string;
  username: string;
  email: string;
  eventId: string;
  isAdmin: true;
};

export type ParticipantSession = {
  role: "participant";
  id: string;
  displayName: string;
  eventId: string;
  isAdmin: false;
};

export type SessionUser = AdminSession | ParticipantSession;

// --- Password hashing (admins only) ---
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- Access codes (shown on display / typed at join) ---
// Avoid ambiguous chars (0/O, 1/I) so codes read cleanly on a projector.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// --- Signed auth token ---
function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function signAuthToken(
  role: "admin" | "participant",
  id: string
): string {
  const payload = `${role}.${id}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAuthToken(
  token: string | undefined
): { role: "admin" | "participant"; id: string } | null {
  if (!token) return null;
  // token = role.id.sig  (id is a cuid — no dots; role is a|participant word)
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, id, sig] = parts;
  if (role !== "admin" && role !== "participant") return null;
  if (!id || !sig) return null;
  const payload = `${role}.${id}`;
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  return { role, id };
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

// --- Current-session resolution ---
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  const parsed = verifyAuthToken(token);
  if (!parsed) return null;

  if (parsed.role === "admin") {
    const user = await prisma.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, username: true, email: true, isAdmin: true },
    });
    if (!user?.isAdmin) return null;
    // Prefer the admin's first owned event (Phase 5 can pick among many).
    const event = await prisma.event.findFirst({
      where: { adminId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!event) return null;
    return {
      role: "admin",
      id: user.id,
      username: user.username,
      email: user.email,
      eventId: event.id,
      isAdmin: true,
    };
  }

  const participant = await prisma.participant.findUnique({
    where: { id: parsed.id },
    select: { id: true, displayName: true, eventId: true },
  });
  if (!participant) return null;
  return {
    role: "participant",
    id: participant.id,
    displayName: participant.displayName,
    eventId: participant.eventId,
    isAdmin: false,
  };
}

export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

export async function requireAdmin(): Promise<AdminSession | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function requireParticipant(): Promise<ParticipantSession | null> {
  const user = await getCurrentUser();
  return user?.role === "participant" ? user : null;
}
