import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireStaffOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// POST /api/owner/admin-password  { userId, newPassword }  — owner only.
export async function POST(req: Request) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can reset organizer passwords." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    newPassword?: string;
  };
  const userId = body.userId?.trim();
  const newPassword = body.newPassword || "";

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Organizer not found." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await logActivity({
    type: "organizer.password_reset",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    targetType: "organizer",
    targetId: userId,
    details: `password reset for ${user.username}`,
  });

  return NextResponse.json({ ok: true, userId });
}
