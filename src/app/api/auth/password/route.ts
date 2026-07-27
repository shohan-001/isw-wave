import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  verifyPassword,
  hashPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/password  { currentPassword, newPassword }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 401 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
