import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, requireStaffOwner } from "@/lib/auth";
import { ACTIVITY_TYPES, logActivity, logRetentionDays } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

// GET /api/owner/logs?type=&page=
export async function GET(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "").trim();
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const where = type ? { type } : {};

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    logs: rows.map((r) => ({
      id: r.id,
      type: r.type,
      actorType: r.actorType,
      actorLabel: r.actorLabel,
      eventId: r.eventId,
      targetType: r.targetType,
      targetId: r.targetId,
      details: r.details,
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    types: ACTIVITY_TYPES,
    retentionDays: logRetentionDays(),
    canPrune: staff.role === "owner",
  });
}

// DELETE /api/owner/logs?olderThanDays=30 | ?type=staff.login | ?all=1  (owner only)
export async function DELETE(req: Request) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can delete logs." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const olderThanDays = Number(url.searchParams.get("olderThanDays"));
  const type = (url.searchParams.get("type") || "").trim();
  const all = url.searchParams.get("all") === "1";

  let deleted = 0;
  let mode = "";

  if (all) {
    mode = "all";
    deleted = (await prisma.activityLog.deleteMany({})).count;
  } else if (type) {
    mode = `type=${type}`;
    deleted = (await prisma.activityLog.deleteMany({ where: { type } })).count;
  } else if (Number.isFinite(olderThanDays) && olderThanDays >= 0) {
    mode = `olderThan=${olderThanDays}d`;
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    deleted = (
      await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    ).count;
  } else {
    return NextResponse.json(
      { error: "Pass olderThanDays, type, or all=1." },
      { status: 400 }
    );
  }

  // Logged after the delete so the audit entry survives an "all" purge.
  await logActivity({
    type: "logs.pruned",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    details: `${mode} removed ${deleted} row(s)`,
  });

  return NextResponse.json({ ok: true, deleted });
}
