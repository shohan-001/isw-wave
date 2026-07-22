import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/owner/ban  { participantId, banned, reason? }
export async function POST(req: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    participantId?: string;
    banned?: boolean;
    reason?: string;
  };
  const participantId = body.participantId?.trim();
  if (!participantId || typeof body.banned !== "boolean") {
    return NextResponse.json(
      { error: "participantId and banned are required." },
      { status: 400 }
    );
  }

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data: body.banned
      ? {
          banned: true,
          bannedAt: new Date(),
          banReason: (body.reason || "").trim().slice(0, 200),
        }
      : {
          banned: false,
          bannedAt: null,
          banReason: "",
        },
  });

  return NextResponse.json({
    participant: {
      id: updated.id,
      displayName: updated.displayName,
      eventId: updated.eventId,
      banned: updated.banned,
      bannedAt: updated.bannedAt?.toISOString() ?? null,
      banReason: updated.banReason,
    },
  });
}
