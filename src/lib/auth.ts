import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { AUTH_COOKIE } from "./constants";

// --- Phase 2/5 auth ------------------------------------------------------------
//
// Signed cookie (`isw_auth`):
//   admin.{userId}.{eventId}.{sig}  — admin (password login, active event)
//   admin.{userId}.{sig}            — legacy admin token (first event fallback)
//   participant.{participantId}.{sig} — attendee (name + event access code)

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

async function resolveAdminEvent(
  userId: string,
  preferredEventId?: string
): Promise<{ id: string; slug: string } | null> {
  if (preferredEventId) {
    const owned = await prisma.event.findFirst({
      where: { id: preferredEventId, adminId: userId },
      select: { id: true, slug: true },
    });
    if (owned) return owned;
  }
  return prisma.event.findFirst({
    where: { adminId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });
}

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

    const event = await resolveAdminEvent(user.id, parsed.eventId);

    return {
      role: "admin",
      id: user.id,
      username: user.username,
      email: user.email,
      eventId: event?.id ?? "",
      eventSlug: event?.slug ?? "",
      isAdmin: true,
    };
  }

  const participant = await prisma.participant.findUnique({
    where: { id: parsed.id },
    select: {
      id: true,
      displayName: true,
      eventId: true,
      event: { select: { slug: true } },
    },
  });
  if (!participant) return null;

  return {
    role: "participant",
    id: participant.id,
    displayName: participant.displayName,
    eventId: participant.eventId,
    eventSlug: participant.event.slug,
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

export async function setAdminSession(userId: string, eventId: string): Promise<void> {
  cookies().set(
    AUTH_COOKIE,
    signAuthToken("admin", userId, eventId),
    authCookieOptions()
  );
}

export async function assertAdminOwnsEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, adminId: userId },
    select: { id: true },
  });
  return !!event;
}
