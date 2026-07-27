import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const BCRYPT_ROUNDS = 10;

export type AdminSession = {
  role: "admin";
  id: string;
  username: string;
  email: string;
  eventId: string;
  eventSlug: string;
  isAdmin: true;
};

export type ParticipantSession = {
  role: "participant";
  id: string;
  displayName: string;
  eventId: string;
  eventSlug: string;
  isAdmin: false;
};

export type SessionUser = AdminSession | ParticipantSession;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

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

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function verifySig(payload: string, sig: string): boolean {
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function signAuthToken(
  role: "admin" | "participant",
  id: string,
  eventId?: string
): string {
  const payload =
    role === "admin" && eventId ? `admin.${id}.${eventId}` : `${role}.${id}`;
  return `${payload}.${sign(payload)}`;
}

export type ParsedAuthToken = {
  role: "admin" | "participant";
  id: string;
  eventId?: string;
};

export function verifyAuthToken(token: string | undefined): ParsedAuthToken | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;

  if (parts[0] === "admin" && parts.length === 4) {
    const [, userId, eventId, sig] = parts;
    if (!userId || !eventId || !sig) return null;
    const payload = `admin.${userId}.${eventId}`;
    if (!verifySig(payload, sig)) return null;
    return { role: "admin", id: userId, eventId };
  }

  if (parts.length !== 3) return null;
  const [role, id, sig] = parts;
  if (role !== "admin" && role !== "participant") return null;
  if (!id || !sig) return null;
  const payload = `${role}.${id}`;
  if (!verifySig(payload, sig)) return null;
  return { role, id };
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
