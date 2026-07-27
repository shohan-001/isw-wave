import { NextResponse } from "next/server";
import { clearOwnerSession, getStaffSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function POST() {
  const staff = await getStaffSession();
  if (staff) {
    await logActivity({
      type: "staff.logout",
      actorType: "staff",
      actorId: staff.id,
      actorLabel: staff.username,
    });
  }
  await clearOwnerSession();
  return NextResponse.json({ ok: true });
}
