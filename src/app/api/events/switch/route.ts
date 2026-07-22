import { NextResponse } from "next/server";
import { requireAdmin, setAdminSession, assertAdminOwnsEvent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/events/switch { eventId } — set active admin event in session.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { eventId?: string };
  const eventId = (body.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId required." }, { status: 400 });
  }

  const ok = await assertAdminOwnsEvent(admin.id, eventId);
  if (!ok) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  await setAdminSession(admin.id, eventId);
  return NextResponse.json({ ok: true, eventId });
}
