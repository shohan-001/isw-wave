import crypto from "crypto";
import { prisma } from "./db";

// Organizer signup is invite-gated because YOUTUBE_API_KEY and its 10k/day
// quota are shared by every event (see youtube-quota.ts — one row per day, no
// per-org split). An unrestricted signup lets a stranger's guests drain the
// quota and break search at a live event.
//
// Codes now live in the InviteCode table so staff can label, cap, expire, and
// revoke them from the ops console. ORGANIZER_INVITE_CODE stays as a fallback so
// codes handed out before that existed keep working; it has no usage tracking.

function configuredCodes(): string[] {
  return (process.env.ORGANIZER_INVITE_CODE || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function envInviteConfigured(): boolean {
  return configuredCodes().length > 0;
}

function digest(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

function matchesEnvCode(supplied: string): boolean {
  const a = digest(supplied);
  return configuredCodes().some((code) =>
    crypto.timingSafeEqual(a, digest(code))
  );
}

/** Codes are compared lowercase so a retyped code isn't rejected on case. */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export type InviteResolution =
  | {
      ok: true;
      source: "db";
      id: string;
      label: string;
      eventLimit: number;
    }
  | { ok: true; source: "env"; eventLimit: number }
  | {
      ok: false;
      reason: "unconfigured" | "invalid" | "revoked" | "expired" | "exhausted";
    };

/** True when at least one route into signup is open. */
export async function organizerInviteConfigured(): Promise<boolean> {
  if (envInviteConfigured()) return true;
  const usable = await prisma.inviteCode
    .count({ where: { revokedAt: null } })
    .catch(() => 0);
  return usable > 0;
}

/**
 * Validate a supplied code without consuming it.
 *
 * Distinguishes revoked / expired / exhausted from plain invalid so the signup
 * form can tell someone their real code has lapsed instead of implying they
 * mistyped it.
 */
export async function resolveInviteCode(
  supplied: string
): Promise<InviteResolution> {
  const candidate = normalizeCode(supplied);
  if (!candidate) return { ok: false, reason: "invalid" };

  const record = await prisma.inviteCode
    .findUnique({ where: { code: candidate } })
    .catch(() => null);

  if (record) {
    if (record.revokedAt) return { ok: false, reason: "revoked" };
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (record.maxUses > 0 && record.usedCount >= record.maxUses) {
      return { ok: false, reason: "exhausted" };
    }
    return {
      ok: true,
      source: "db",
      id: record.id,
      label: record.label,
      eventLimit: record.eventLimit,
    };
  }

  if (envInviteConfigured() && matchesEnvCode(supplied.trim())) {
    // Env codes predate per-code limits, so they stay uncapped.
    return { ok: true, source: "env", eventLimit: 0 };
  }

  if (!envInviteConfigured()) {
    const anyCodes = await prisma.inviteCode.count().catch(() => 0);
    if (!anyCodes) return { ok: false, reason: "unconfigured" };
  }

  return { ok: false, reason: "invalid" };
}

/**
 * Take a seat on a code before the account is created.
 *
 * Claiming up front is what actually enforces `maxUses`: the re-checked
 * conditional update means two simultaneous signups on a single-use code can't
 * both win, because the loser updates 0 rows. Validating first and incrementing
 * afterwards would let both through. The caller must call releaseInviteCode if
 * account creation then fails.
 */
export async function claimInviteCode(id: string): Promise<boolean> {
  const result = await prisma.$executeRaw`
    UPDATE "InviteCode"
    SET "usedCount" = "usedCount" + 1, "lastUsedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "revokedAt" IS NULL
      AND ("maxUses" = 0 OR "usedCount" < "maxUses")
  `.catch(() => 0);

  return result > 0;
}

/** Hand a claimed seat back when signup fails after the claim. */
export async function releaseInviteCode(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "InviteCode"
    SET "usedCount" = MAX("usedCount" - 1, 0)
    WHERE "id" = ${id}
  `.catch(() => 0);
}

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Readable random suffix — no look-alike characters to misread over a phone. */
export function generateCode(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);

  const bytes = crypto.randomBytes(8);
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }

  return slug ? `${slug}-${suffix}` : `wave-${suffix}`;
}
