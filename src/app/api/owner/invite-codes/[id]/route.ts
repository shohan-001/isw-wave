import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaffOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// PATCH /api/owner/invite-codes/[id] — { action: "revoke" | "restore" } (owner only).
//
// Revoke is a soft flag rather than a delete so the code stays visible in the
// list and its usage history keeps making sense in the activity log.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can change invite codes." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const record = await prisma.inviteCode.findUnique({
    where: { id: params.id },
  });
  if (!record) {
    return NextResponse.json({ error: "Code not found." }, { status: 404 });
  }

  if (body.action !== "revoke" && body.action !== "restore") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const revoking = body.action === "revoke";
  await prisma.inviteCode.update({
    where: { id: record.id },
    data: { revokedAt: revoking ? new Date() : null },
  });

  await logActivity({
    type: "invite.revoked",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    targetType: "inviteCode",
    targetId: record.id,
    details: `${revoking ? "revoked" : "restored"} "${
      record.label || record.code
    }" after ${record.usedCount} use${record.usedCount === 1 ? "" : "s"}`,
  });

  return NextResponse.json({ ok: true, revoked: revoking });
}

// DELETE /api/owner/invite-codes/[id] — drop an unused code entirely (owner only).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const owner = await requireStaffOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner can delete invite codes." },
      { status: 403 }
    );
  }

  const record = await prisma.inviteCode.findUnique({
    where: { id: params.id },
  });
  if (!record) {
    return NextResponse.json({ error: "Code not found." }, { status: 404 });
  }

  // Used codes are kept so the audit trail can still resolve which code an
  // organizer came in on; revoke those instead.
  if (record.usedCount > 0) {
    return NextResponse.json(
      {
        error:
          "This code has been used, so it's kept for the audit trail. Revoke it instead.",
      },
      { status: 409 }
    );
  }

  await prisma.inviteCode.delete({ where: { id: record.id } });

  await logActivity({
    type: "invite.revoked",
    actorType: "staff",
    actorId: owner.id,
    actorLabel: owner.username,
    targetType: "inviteCode",
    targetId: record.id,
    details: `deleted unused code "${record.label || record.code}"`,
  });

  return NextResponse.json({ ok: true, deleted: true });
}
