import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import { nextQueuePosition, toPublicRequest } from "@/lib/queries";
import {
  notifyPending,
  notifyQueue,
  notifyRequests,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = admin.eventId;
  const id = params.id;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    direction?: "up" | "down";
  };
  const action = body.action;

  const target = await prisma.request.findUnique({ where: { id } });
  if (!target || target.eventId !== eventId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  let response: NextResponse;

  switch (action) {
    case "approve": {
      const updated = await prisma.request.update({
        where: { id },
        data: {
          status: STATUS.APPROVED,
          queuePosition: await nextQueuePosition(eventId),
          flagged: false,
          flagReason: "",
        },
      });
      response = NextResponse.json({ request: toPublicRequest(updated) });
      break;
    }

    case "reject":
    case "remove": {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      if (event.currentRequestId === id) {
        await advanceToNext(eventId, id);
      }
      const updated = await prisma.request.update({
        where: { id },
        data: { status: STATUS.REJECTED, queuePosition: null },
      });
      response = NextResponse.json({ request: toPublicRequest(updated) });
      break;
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
          eventId,
          status: STATUS.APPROVED,
          queuePosition:
            dir === "up"
              ? { lt: target.queuePosition }
              : { gt: target.queuePosition },
        },
        orderBy: { queuePosition: dir === "up" ? "desc" : "asc" },
      });
      if (!neighbor || neighbor.queuePosition == null) {
        response = NextResponse.json({ request: toPublicRequest(target) });
        break;
      }
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
      response = NextResponse.json({ request: toPublicRequest(updated!) });
      break;
    }

    case "play": {
      if (target.status !== STATUS.APPROVED) {
        return NextResponse.json(
          { error: "Only approved songs can be played." },
          { status: 400 }
        );
      }
      await prisma.event.update({
        where: { id: eventId },
        data: { currentRequestId: id },
      });
      response = NextResponse.json({ ok: true });
      break;
    }

    case "next": {
      const nextId = await advanceToNext(eventId, id);
      await prisma.request.update({
        where: { id },
        data: { status: STATUS.PLAYED, queuePosition: null },
      });
      response = NextResponse.json({ ok: true, nextRequestId: nextId });
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await Promise.all([
    notifyQueue(eventId),
    notifyPending(eventId),
    notifyRequests(eventId),
  ]);
  return response;
}

async function advanceToNext(
  eventId: string,
  excludeId: string
): Promise<string | null> {
  const next = await prisma.request.findFirst({
    where: {
      eventId,
      status: STATUS.APPROVED,
      id: { not: excludeId },
    },
    orderBy: { queuePosition: "asc" },
  });
  await prisma.event.update({
    where: { id: eventId },
    data: { currentRequestId: next?.id ?? null },
  });
  return next?.id ?? null;
}
