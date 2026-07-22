import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, setAdminSession } from "@/lib/auth";
import {
  generateAccessCode,
} from "@/lib/auth";
import { slugify, isValidSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

// GET /api/events — list events for the logged-in organizer.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { adminId: admin.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      accessCode: true,
      accentColor: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    events,
    activeEventId: admin.eventId || null,
  });
}

// POST /api/events — create a new event for the organizer.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { ownerId: admin.id },
  });
  if (!org) {
    return NextResponse.json(
      { error: "No organization found for this account." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    requestLimit?: number;
    approvalMode?: string;
    accentColor?: string;
  };

  const name = (body.name || "").trim().slice(0, 80);
  const slug = slugify(body.slug || name);
  const requestLimit = Math.min(20, Math.max(1, Number(body.requestLimit) || 3));
  const approvalMode = body.approvalMode === "auto" ? "auto" : "manual";
  const accentColor = (body.accentColor || "#e0338f").trim();

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Event name must be at least 2 characters." },
      { status: 400 }
    );
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json(
      {
        error:
          "URL slug must be 2–48 characters: lowercase letters, numbers, and hyphens.",
      },
      { status: 400 }
    );
  }

  const slugTaken = await prisma.event.findUnique({ where: { slug } });
  if (slugTaken) {
    return NextResponse.json(
      { error: "That URL slug is already taken. Pick another." },
      { status: 409 }
    );
  }

  let accessCode = generateAccessCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.event.findUnique({ where: { accessCode } });
    if (!clash) break;
    accessCode = generateAccessCode();
  }

  const event = await prisma.event.create({
    data: {
      name,
      slug,
      accessCode,
      organizationId: org.id,
      adminId: admin.id,
      requestLimit,
      approvalMode,
      accentColor,
    },
  });

  await setAdminSession(admin.id, event.id);

  return NextResponse.json({ event });
}
