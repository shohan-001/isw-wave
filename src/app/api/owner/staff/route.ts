import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireStaff, requireStaffOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// GET /api/owner/staff — list staff accounts (any staff may view).
export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.user.findMany({
    where: { staffRole: { in: ["owner", "moderator"] } },
    orderBy: [{ staffRole: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      email: true,
      staffRole: true,
      disabledAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    staff: rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.staffRole,
      disabled: Boolean(r.disabledAt),
      createdAt: r.createdAt.toISOString(),
      isSelf: r.id === staff.id,
    })),
    viewerRole: staff.role,
  });
}

// POST /api/owner/staff — create a moderator or owner (owner only).
export async function POST(req: Request) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can add staff." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  const username = (body.username || "").trim().toLowerCase().slice(0, 32);
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const role = body.role === "owner" ? "owner" : "moderator";

  if (username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true, staffRole: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That username or email already exists." },
      { status: 409 }
    );
  }

  const created = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hashPassword(password),
      // Staff are not organizers: no Organization, no event control room.
      isAdmin: false,
      staffRole: role,
    },
    select: { id: true, username: true, email: true, staffRole: true },
  });

  await logActivity({
    type: "staff.created",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    targetType: "staff",
    targetId: created.id,
    details: `${created.username} as ${role}`,
  });

  return NextResponse.json({ staff: created });
}
