import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import type { EventStats } from "@/lib/types";

export const dynamic = "force-dynamic";

 // GET /api/stats — live event counters for the admin stats bar.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!admin.eventId) {
    return NextResponse.json({ error: "No active event." }, { status: 400 });
  }
  const eventId = admin.eventId;

  const [totalRequests, approved, rejected, pending, played, queueRows, top] =
    await Promise.all([
      prisma.request.count({ where: { eventId } }),
      prisma.request.count({
        where: { eventId, status: { in: [STATUS.APPROVED, STATUS.PLAYED] } },
      }),
      prisma.request.count({ where: { eventId, status: STATUS.REJECTED } }),
      prisma.request.count({ where: { eventId, status: STATUS.PENDING } }),
      prisma.request.count({ where: { eventId, status: STATUS.PLAYED } }),
      prisma.request.findMany({
        where: { eventId, status: STATUS.APPROVED },
        select: { id: true },
      }),
      prisma.request.groupBy({
        by: ["requesterName"],
        where: { eventId },
        _count: { _all: true },
        orderBy: { _count: { requesterName: "desc" } },
        take: 1,
      }),
    ]);

  const stats: EventStats = {
    totalRequests,
    approved,
    rejected,
    pending,
    played,
    queueLength: queueRows.length,
    mostActiveRequester: top[0]?.requesterName ?? null,
    mostActiveCount: top[0]?._count._all ?? 0,
  };
  return NextResponse.json({ stats });
}
