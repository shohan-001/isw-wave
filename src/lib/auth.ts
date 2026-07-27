import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { AUTH_COOKIE, OWNER_COOKIE } from "./constants";
import {
  hashPassword,
  verifyPassword,
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
      event: { select: { slug: true, suspended: true } },
    },
  });
  // Banned or suspended event → look logged out so guest UI can't keep acting.
  if (!participant || participant.banned || participant.event.suspended) {
    return null;
  }

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

// --- Ops console: secret path + named staff accounts --------------------------
//
// The cookie carries the staff user id so every action can be attributed in
// ActivityLog. OWNER_PASSWORD is now a bootstrap credential only: it works until
// the first staff account exists, which solves the chicken-and-egg of needing a
// login to create the first login.

export type StaffRole = "owner" | "moderator";

export type StaffSession = {
  id: string;
  username: string;
  email: string;
  role: StaffRole;
};

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

export function signStaffToken(userId: string): string {
  const payload = `staff.${userId}`;
  return `${payload}.${signOwner(payload)}`;
}

function parseStaffToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "staff") return null;
  const [, userId, mac] = parts;
  const expected = signOwner(`staff.${userId}`);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    return null;
  }
  return userId;
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

export async function setStaffSession(userId: string): Promise<void> {
  cookies().set(OWNER_COOKIE, signStaffToken(userId), ownerCookieOptions());
}

export async function clearOwnerSession(): Promise<void> {
  cookies().set(OWNER_COOKIE, "", { ...ownerCookieOptions(), maxAge: 0 });
}

function toStaffRole(value: string): StaffRole | null {
  return value === "owner" || value === "moderator" ? value : null;
}

/** Current staff session, or null. Disabled accounts resolve as logged out. */
export async function getStaffSession(): Promise<StaffSession | null> {
  if (!getOwnerPanelPath()) return null;

  // Prefer Bearer (Flutter / native clients), then the ops cookie (web console).
  const userId =
    parseStaffToken(readBearerToken()) ||
    parseStaffToken(cookies().get(OWNER_COOKIE)?.value);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      staffRole: true,
      disabledAt: true,
    },
  });
  if (!user || user.disabledAt) return null;

  const role = toStaffRole(user.staffRole);
  if (!role) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role,
  };
}

/** Any staff member (owner or moderator). */
export async function requireStaff(): Promise<StaffSession | null> {
  return getStaffSession();
}

/** Owner only — access grants, credentials, and destructive log actions. */
export async function requireStaffOwner(): Promise<StaffSession | null> {
  const staff = await getStaffSession();
  return staff?.role === "owner" ? staff : null;
}

export async function staffAccountsExist(): Promise<boolean> {
  const count = await prisma.user.count({
    where: { staffRole: { in: ["owner", "moderator"] } },
  });
  return count > 0;
}

function matchesBootstrapPassword(plain: string): boolean {
  const expected = process.env.OWNER_PASSWORD?.trim() || "";
  if (!expected || !plain) return false;
  const a = crypto.createHmac("sha256", ownerSecret()).update(plain).digest();
  const b = crypto.createHmac("sha256", ownerSecret()).update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export type StaffLoginResult =
  | { ok: true; staff: StaffSession; bootstrapped: boolean }
  | { ok: false; reason: "unconfigured" | "invalid" | "disabled" };

/**
 * Sign in to the ops console.
 *
 * Normal path: match a User with a staffRole and verify their bcrypt hash.
 * Bootstrap path: while no staff account exists, OWNER_PASSWORD promotes (or
 * creates) the named account to owner so the console is reachable on a fresh
 * deployment.
 */
export async function staffLogin(
  identifier: string,
  password: string
): Promise<StaffLoginResult> {
  if (!getOwnerPanelPath()) return { ok: false, reason: "unconfigured" };

  const needle = identifier.trim().toLowerCase();
  if (!needle || !password) return { ok: false, reason: "invalid" };

  const candidates = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      staffRole: true,
      disabledAt: true,
    },
  });
  // SQLite comparisons are case-sensitive; match in JS like /api/auth/login does.
  const user = candidates.find(
    (u) =>
      u.username.toLowerCase() === needle || u.email.toLowerCase() === needle
  );

  const existingStaffRole = user ? toStaffRole(user.staffRole) : null;

  if (user && existingStaffRole) {
    if (user.disabledAt) return { ok: false, reason: "disabled" };
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false, reason: "invalid" };
    return {
      ok: true,
      bootstrapped: false,
      staff: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: existingStaffRole,
      },
    };
  }

  // Bootstrap only while no staff exists at all.
  if (!ownerPasswordConfigured()) return { ok: false, reason: "invalid" };
  if (await staffAccountsExist()) return { ok: false, reason: "invalid" };
  if (!matchesBootstrapPassword(password)) return { ok: false, reason: "invalid" };

  const passwordHash = await hashPassword(password);

  if (user) {
    const promoted = await prisma.user.update({
      where: { id: user.id },
      data: { staffRole: "owner", disabledAt: null },
      select: { id: true, username: true, email: true },
    });
    return { ok: true, bootstrapped: true, staff: { ...promoted, role: "owner" } };
  }

  const created = await prisma.user.create({
    data: {
      username: needle.includes("@") ? needle.split("@")[0] : needle,
      email: needle.includes("@") ? needle : `${needle}@local.ops`,
      passwordHash,
      isAdmin: false,
      staffRole: "owner",
    },
    select: { id: true, username: true, email: true },
  });
  return { ok: true, bootstrapped: true, staff: { ...created, role: "owner" } };
}
