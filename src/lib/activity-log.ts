import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

// Audit trail for the ops console. Every mutating staff route funnels through
// logActivity so coverage doesn't depend on remembering to log at each call site.

export const ACTIVITY_TYPES = [
  "staff.login",
  "staff.login_failed",
  "staff.logout",
  "staff.created",
  "staff.updated",
  "staff.password_reset",
  "guest.banned",
  "guest.unbanned",
  "organizer.password_reset",
  "organizer.password_set",
  "request.submitted",
  "request.approved",
  "request.rejected",
  "invite.created",
  "invite.revoked",
  "invite.used",
  "event.suspended",
  "event.unsuspended",
  "event.quota_cap_updated",
  "logs.pruned",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const DEFAULT_RETENTION_DAYS = 30;

export function logRetentionDays(): number {
  const raw = Number(process.env.LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS;
}

/** Client IP behind Vercel's proxy; x-forwarded-for may hold a comma list. */
function clientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return (first || h.get("x-real-ip") || "").slice(0, 64);
}

function clientUserAgent(): string {
  return (headers().get("user-agent") || "").slice(0, 300);
}

// Prune at most once per process per day — cheap on Turso, and log volume here
// is low enough that same-day precision doesn't matter.
let lastPruneDay = "";

async function pruneIfDue(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;

  const cutoff = new Date(Date.now() - logRetentionDays() * 86_400_000);
  await prisma.activityLog
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch(() => undefined);
}

export type LogInput = {
  type: ActivityType;
  actorType?: "staff" | "organizer" | "guest" | "system";
  actorId?: string;
  actorLabel?: string;
  eventId?: string;
  targetType?: string;
  targetId?: string;
  details?: string;
};

/** Never throws — a failed audit write must not break the action it describes. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        type: input.type,
        actorType: input.actorType || "system",
        actorId: input.actorId || "",
        actorLabel: (input.actorLabel || "").slice(0, 120),
        eventId: input.eventId || "",
        targetType: input.targetType || "",
        targetId: input.targetId || "",
        details: (input.details || "").slice(0, 500),
        ip: clientIp(),
        userAgent: clientUserAgent(),
      },
    });
    await pruneIfDue();
  } catch (err) {
    console.error("[activity-log]", err);
  }
}
