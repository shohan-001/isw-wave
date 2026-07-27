import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";
import { hashPassword } from "./auth-core";
import { getPublicBaseUrl } from "./public-url";

// Single-use links so approval emails never carry a plaintext password. Only the
// SHA-256 hash is stored, so a database leak can't be replayed to take over an
// organizer account.

const TOKEN_TTL_HOURS = 72;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function createSetupToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");

  // One live link per user: supersede anything outstanding.
  await prisma.passwordSetupToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordSetupToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000),
    },
  });

  return raw;
}

export function setupUrl(rawToken: string): string {
  return `${getPublicBaseUrl()}/organizer/set-password?token=${rawToken}`;
}

export type SetupTokenState =
  | { valid: true; userId: string; username: string }
  | { valid: false; reason: "unknown" | "used" | "expired" };

export async function inspectSetupToken(
  rawToken: string
): Promise<SetupTokenState> {
  if (!rawToken) return { valid: false, reason: "unknown" };

  const row = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row) return { valid: false, reason: "unknown" };
  if (row.usedAt) return { valid: false, reason: "used" };
  if (row.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { id: true, username: true },
  });
  if (!user) return { valid: false, reason: "unknown" };

  return { valid: true, userId: user.id, username: user.username };
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unknown" | "used" | "expired" };

export async function consumeSetupToken(
  rawToken: string,
  newPassword: string
): Promise<ConsumeResult> {
  const state = await inspectSetupToken(rawToken);
  if (!state.valid) return { ok: false, reason: state.reason };

  const tokenHash = hashToken(rawToken);

  // Mark used first and only proceed if this call won the race, so a double
  // submit can't set the password twice.
  const claimed = await prisma.passwordSetupToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "used" };

  await prisma.user.update({
    where: { id: state.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { ok: true, userId: state.userId };
}
