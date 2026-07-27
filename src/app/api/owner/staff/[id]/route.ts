import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireStaffOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// PATCH /api/owner/staff/[id]  { action: "disable" | "enable" | "role" | "password" }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can manage staff." },
      { status: 403 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, username: true, staffRole: true, disabledAt: true },
  });
  if (!target || !["owner", "moderator"].includes(target.staffRole)) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    role?: string;
    password?: string;
  };

  // Guard against locking yourself out of the console.
  const selfLockout =
    target.id === owner.id &&
    (body.action === "disable" ||
      (body.action === "role" && body.role !== "owner"));
  if (selfLockout) {
    return NextResponse.json(
      { error: "You can't disable or demote your own owner account." },
      { status: 400 }
    );
  }

  switch (body.action) {
    case "disable":
    case "enable": {
      const disable = body.action === "disable";
      await prisma.user.update({
        where: { id: target.id },
        data: { disabledAt: disable ? new Date() : null },
      });
      await logActivity({
        type: "staff.updated",
        actorType: "staff",
        actorId: owner.id,
        actorLabel: owner.username,
        targetType: "staff",
        targetId: target.id,
        details: `${disable ? "disabled" : "enabled"} ${target.username}`,
      });
      return NextResponse.json({ ok: true });
    }

    case "role": {
      const role = body.role === "owner" ? "owner" : "moderator";
      await prisma.user.update({
        where: { id: target.id },
        data: { staffRole: role },
      });
      await logActivity({
        type: "staff.updated",
        actorType: "staff",
        actorId: owner.id,
        actorLabel: owner.username,
        targetType: "staff",
        targetId: target.id,
        details: `role -> ${role} for ${target.username}`,
      });
      return NextResponse.json({ ok: true });
    }

    case "password": {
      const password = body.password || "";
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters." },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash: await hashPassword(password) },
      });
      await logActivity({
        type: "staff.password_reset",
        actorType: "staff",
        actorId: owner.id,
        actorLabel: owner.username,
        targetType: "staff",
        targetId: target.id,
        details: `password reset for ${target.username}`,
      });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
