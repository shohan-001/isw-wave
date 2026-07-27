import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, requireStaffOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import {
  envInviteConfigured,
  generateCode,
  normalizeCode,
} from "@/lib/organizer-invite";
import { getPublicBaseUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const MAX_LABEL = 80;

// GET /api/owner/invite-codes — list codes (any staff may view).
export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.inviteCode.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
  });

  const now = Date.now();
  return NextResponse.json({
    viewerRole: staff.role,
    // Surfaced so staff know legacy env codes are still accepted and invisible here.
    envFallbackActive: envInviteConfigured(),
    signupUrl: `${getPublicBaseUrl()}/organizer/signup`,
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      maxUses: r.maxUses,
      usedCount: r.usedCount,
      eventLimit: r.eventLimit,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      status: r.revokedAt
        ? "revoked"
        : r.expiresAt && r.expiresAt.getTime() < now
          ? "expired"
          : r.maxUses > 0 && r.usedCount >= r.maxUses
            ? "exhausted"
            : "active",
    })),
  });
}

// POST /api/owner/invite-codes — mint a code (owner only).
export async function POST(req: Request) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can create invite codes." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    label?: string;
    code?: string;
    maxUses?: number;
    eventLimit?: number;
    expiresInDays?: number;
  };

  const label = (body.label || "").trim().slice(0, MAX_LABEL);
  if (!label) {
    return NextResponse.json(
      { error: "Give the code a label so you know who it went to." },
      { status: 400 }
    );
  }

  const custom = normalizeCode(body.code || "");
  if (custom && !/^[a-z0-9][a-z0-9-]{5,47}$/.test(custom)) {
    return NextResponse.json(
      {
        error:
          "Custom codes must be 6-48 characters: lowercase letters, numbers, and dashes.",
      },
      { status: 400 }
    );
  }

  const code = custom || generateCode(label);
  const maxUses = clampInt(body.maxUses, 0, 500);
  const eventLimit = clampInt(body.eventLimit, 0, 50);
  const expiresInDays = clampInt(body.expiresInDays, 0, 365);
  const expiresAt =
    expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

  const clash = await prisma.inviteCode.findUnique({ where: { code } });
  if (clash) {
    return NextResponse.json(
      { error: "That code already exists. Pick another." },
      { status: 409 }
    );
  }

  const created = await prisma.inviteCode.create({
    data: {
      code,
      label,
      maxUses,
      eventLimit,
      expiresAt,
      createdById: owner.id,
    },
  });

  await logActivity({
    type: "invite.created",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    targetType: "inviteCode",
    targetId: created.id,
    details: `"${label}" · uses ${maxUses || "unlimited"} · event limit ${
      eventLimit || "unlimited"
    }${expiresAt ? ` · expires ${expiresAt.toISOString().slice(0, 10)}` : ""}`,
  });

  return NextResponse.json({
    code: {
      id: created.id,
      code: created.code,
      label: created.label,
      maxUses: created.maxUses,
      usedCount: 0,
      eventLimit: created.eventLimit,
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: created.createdAt.toISOString(),
      status: "active",
    },
    signupUrl: `${getPublicBaseUrl()}/organizer/signup`,
  });
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
