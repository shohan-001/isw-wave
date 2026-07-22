import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import {
  notifyPending,
  notifyQueue,
  notifyRequests,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";

 // POST /api/requests/bulk
 // { action: "reject", keyword: "..." } — reject all pending whose title
 // contains the keyword (case-insensitive). For coordinated spam waves.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    keyword?: string;
  };

  if (body.action !== "reject") {
    return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
  }

  const keyword = (body.keyword || "").trim().toLowerCase();
  if (keyword.length < 2) {
    return NextResponse.json(
      { error: "Enter at least 2 characters to match." },
      { status: 400 }
    );
  }

  const pending = await prisma.request.findMany({
    where: { eventId: admin.eventId, status: STATUS.PENDING },
    select: { id: true, title: true },
  });

  const ids = pending
    .filter((r) => r.title.toLowerCase().includes(keyword))
    .map((r) => r.id);

  if (ids.length === 0) {
    return NextResponse.json({ rejected: 0, matched: 0 });
  }

  await prisma.request.updateMany({
    where: { id: { in: ids }, eventId: admin.eventId },
    data: { status: STATUS.REJECTED, queuePosition: null },
  });

  await Promise.all([
    notifyPending(admin.eventId),
    notifyQueue(admin.eventId),
    notifyRequests(admin.eventId),
  ]);

  return NextResponse.json({ rejected: ids.length, matched: ids.length });
}
