import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EVENT_ID, STATUS } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import { getEvent, nextQueuePosition, toPublicRequest } from "@/lib/queries";

export const dynamic = "force-dynamic";

// PATCH /api/requests/:id   (admin only)
// Body: { action: "approve" | "reject" | "remove" | "move" | "play" | "next" ,
//         direction?: "up" | "down" }
//
// - approve : pending -> approved, appended to the end of the queue
// - reject  : -> rejected, removed from the queue
// - remove  : approved -> rejected (skip/remove a queued song)
// - move    : swap queue position with the up/down neighbour
// - play    : make this the "Now Playing" song (Event.currentRequestId)
// - next    : mark the current Now Playing as played and advance to the next
//             queued song (auto-advance / "Mark as Played")
//
// "Now Playing" is tracked by Event.currentRequestId. The current song keeps
// status "approved" while it plays; the queue endpoint excludes it. When it
// finishes we set it to "played" and point currentRequestId at the next song.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    direction?: "up" | "down";
  };
  const action = body.action;

  const target = await prisma.request.findUnique({ where: { id } });
  if (!target || target.eventId !== EVENT_ID) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  switch (action) {
    case "approve": {
      const updated = await prisma.request.update({
        where: { id },
        data: { status: STATUS.APPROVED, queuePosition: await nextQueuePosition() },
      });
      return NextResponse.json({ request: toPublicRequest(updated) });
    }

    case "reject":
    case "remove": {
      // If we're removing the song that is currently playing, advance first.
      const event = await getEvent();
      if (event.currentRequestId === id) {
        await advanceToNext(id);
      }
      const updated = await prisma.request.update({
        where: { id },
        data: { status: STATUS.REJECTED, queuePosition: null },
      });
      return NextResponse.json({ request: toPublicRequest(updated) });
    }

    case "move": {
      if (target.status !== STATUS.APPROVED || target.queuePosition == null) {
        return NextResponse.json(
          { error: "Only queued songs can be reordered." },
          { status: 400 }
        );
      }
      const dir = body.direction;
      const neighbor = await prisma.request.findFirst({
        where: {
          eventId: EVENT_ID,
          status: STATUS.APPROVED,
          queuePosition:
            dir === "up"
              ? { lt: target.queuePosition }
              : { gt: target.queuePosition },
        },
        orderBy: { queuePosition: dir === "up" ? "desc" : "asc" },
      });
      if (!neighbor || neighbor.queuePosition == null) {
        // Already at the edge; no-op.
        return NextResponse.json({ request: toPublicRequest(target) });
      }
      // Swap positions in a transaction.
      await prisma.$transaction([
        prisma.request.update({
          where: { id: target.id },
          data: { queuePosition: neighbor.queuePosition },
        }),
        prisma.request.update({
          where: { id: neighbor.id },
          data: { queuePosition: target.queuePosition },
        }),
      ]);
      const updated = await prisma.request.findUnique({ where: { id } });
      return NextResponse.json({ request: toPublicRequest(updated!) });
    }

    case "play": {
      // Jump to a specific song as Now Playing. It must be approved.
      if (target.status !== STATUS.APPROVED) {
        return NextResponse.json(
          { error: "Only approved songs can be played." },
          { status: 400 }
        );
      }
      await prisma.event.update({
        where: { id: EVENT_ID },
        data: { currentRequestId: id },
      });
      return NextResponse.json({ ok: true });
    }

    case "next": {
      // Mark the current Now Playing (the target) as played, advance to next.
      const nextId = await advanceToNext(id);
      await prisma.request.update({
        where: { id },
        data: { status: STATUS.PLAYED, queuePosition: null },
      });
      return NextResponse.json({ ok: true, nextRequestId: nextId });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// Set Event.currentRequestId to the next queued (approved) song after
// `excludeId`, or null if the queue is empty. Returns the new current id.
async function advanceToNext(excludeId: string): Promise<string | null> {
  const next = await prisma.request.findFirst({
    where: {
      eventId: EVENT_ID,
      status: STATUS.APPROVED,
      id: { not: excludeId },
    },
    orderBy: { queuePosition: "asc" },
  });
  await prisma.event.update({
    where: { id: EVENT_ID },
    data: { currentRequestId: next?.id ?? null },
  });
  return next?.id ?? null;
}
