import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/owner/admin-password  { userId, newPassword }
export async function POST(req: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({ ok: true, userId });
}
