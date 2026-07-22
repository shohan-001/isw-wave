import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { AUTH_COOKIE, OWNER_COOKIE } from "./constants";
import {
  signAuthToken,
  verifyAuthToken,
  authCookieOptions,
  type AdminSession,
  type ParticipantSession,
  type SessionUser,
} from "./auth-core";

// Re-export password/token helpers so existing imports from @/lib/auth keep working.
export {
  hashPassword,
  verifyPassword,
  generateAccessCode,
  normalizeAccessCode,
  signAuthToken,
  verifyAuthToken,
  authCookieOptions,
  type AdminSession,
  type ParticipantSession,
  type SessionUser,
  type ParsedAuthToken,
} from "./auth-core";

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

function readBearerToken(): string | undefined {
  const h = headers().get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || undefined;
}

export async function sessionFromToken(
  token: string | undefined
): Promise<SessionUser | null> {
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
      banned: true,
      event: { select: { slug: true } },
    },
  });
  if (!participant || participant.banned) return null;

  return {
    role: "participant",
    id: participant.id,
    displayName: participant.displayName,
    eventId: participant.eventId,
    eventSlug: participant.event.slug,
    isAdmin: false,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const bearer = readBearerToken();
  if (bearer) {
    const fromBearer = await sessionFromToken(bearer);
    if (fromBearer) return fromBearer;
  }
  const token = cookies().get(AUTH_COOKIE)?.value;
  return sessionFromToken(token);
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

// --- Owner ops console (secret path + passphrase) -----------------------------

const OWNER_PAYLOAD = "owner.ok";

function ownerSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

export function getOwnerPanelPath(): string {
  return (process.env.OWNER_PANEL_PATH || "").trim().replace(/^\/+|\/+$/g, "");
}

export function ownerPasswordConfigured(): boolean {
  return Boolean(process.env.OWNER_PASSWORD?.trim());
}

function signOwner(value: string): string {
  return crypto
    .createHmac("sha256", ownerSecret())
    .update(value)
    .digest("hex");
}

export function signOwnerToken(): string {
  return `${OWNER_PAYLOAD}.${signOwner(OWNER_PAYLOAD)}`;
}

export function verifyOwnerToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = signOwnerToken();
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function ownerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function setOwnerSession(): Promise<void> {
  cookies().set(OWNER_COOKIE, signOwnerToken(), ownerCookieOptions());
}

export async function clearOwnerSession(): Promise<void> {
  cookies().set(OWNER_COOKIE, "", { ...ownerCookieOptions(), maxAge: 0 });
}

export async function requireOwner(): Promise<boolean> {
  if (!ownerPasswordConfigured() || !getOwnerPanelPath()) return false;
  const token = cookies().get(OWNER_COOKIE)?.value;
  return verifyOwnerToken(token);
}

export async function verifyOwnerPassword(plain: string): Promise<boolean> {
  const expected = process.env.OWNER_PASSWORD?.trim() || "";
  if (!expected || !plain) return false;
  // Constant-time-ish compare via HMAC digests of both sides.
  const a = crypto.createHmac("sha256", ownerSecret()).update(plain).digest();
  const b = crypto.createHmac("sha256", ownerSecret()).update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
