import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

// GET /api/owner/event-requests?status=pending
export async function GET(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = (new URL(req.url).searchParams.get("status") || "").trim();

  const [rows, pendingCount] = await Promise.all([
    prisma.eventRequest.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.eventRequest.count({ where: { status: "pending" } }),
  ]);

  const reviewerIds = rows
    .map((r) => r.reviewedById)
    .filter((id): id is string => Boolean(id));
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, username: true },
      })
    : [];
  const reviewerName = new Map(reviewers.map((r) => [r.id, r.username]));

  return NextResponse.json({
    pendingCount,
    emailConfigured: emailConfigured(),
    requests: rows.map((r) => ({
      id: r.id,
      publicToken: r.publicToken,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      orgName: r.orgName,
      eventName: r.eventName,
      eventDetails: r.eventDetails,
      venue: r.venue,
      expectedGuests: r.expectedGuests,
      startsAt: r.startsAt.toISOString(),
      timezone: r.timezone,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedBy: r.reviewedById ? reviewerName.get(r.reviewedById) || "" : "",
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdEventId: r.createdEventId,
      createdUserId: r.createdUserId,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      // Prefilled so the approve form starts from a sane, editable slug.
      suggestedSlug: slugify(r.eventName),
    })),
  });
}
