import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EVENT_ID } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/settings  (admin only) — current event settings for the admin panel.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = await getEvent();
  const settings: Settings = {
    requestLimit: event.requestLimit,
    approvalMode: event.approvalMode as Settings["approvalMode"],
  };
  return NextResponse.json({ settings, eventName: event.name });
}

// PATCH /api/settings  (admin only)
// Body: { requestLimit?, approvalMode? }
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>;

  const data: { requestLimit?: number; approvalMode?: string } = {};
  if (typeof body.requestLimit === "number") {
    data.requestLimit = Math.min(20, Math.max(1, Math.floor(body.requestLimit)));
  }
  if (body.approvalMode === "manual" || body.approvalMode === "auto") {
    data.approvalMode = body.approvalMode;
  }

  const event = await prisma.event.update({ where: { id: EVENT_ID }, data });
  const settings: Settings = {
    requestLimit: event.requestLimit,
    approvalMode: event.approvalMode as Settings["approvalMode"],
  };
  return NextResponse.json({ settings });
}
