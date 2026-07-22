import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { toPublicRequest } from "@/lib/queries";
import { notifyPending, notifyQueue, notifyRequests } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// POST /api/votes  { requestId }  — toggle upvote (one per participant)
// Allowed on pending (awaiting approval) and approved (in the live queue).
export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session || session.role !== "participant") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { requestId?: string };
  const requestId = body.requestId?.trim();
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId." }, { status: 400 });
  }

  const target = await prisma.request.findUnique({ where: { id: requestId } });
  if (!target || target.eventId !== session.eventId) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const votable =
    target.status === STATUS.PENDING || target.status === STATUS.APPROVED;
  if (!votable) {
    return NextResponse.json(
      { error: "Only pending or queued songs can be voted on." },
      { status: 400 }
    );
  }

  // Don't bump the track that's already on stage.
  const event = await prisma.event.findUnique({
    where: { id: session.eventId },
    select: { currentRequestId: true },
  });
  if (event?.currentRequestId === requestId) {
    return NextResponse.json(
      { error: "That song is already playing." },
      { status: 400 }
    );
  }

  const existing = await prisma.vote.findUnique({
    where: {
      requestId_participantId: {
        requestId,
        participantId: session.id,
      },
    },
  });

  let iVoted: boolean;
  if (existing) {
    await prisma.$transaction([
      prisma.vote.delete({ where: { id: existing.id } }),
      prisma.request.update({
        where: { id: requestId },
        data: { voteCount: { decrement: 1 } },
      }),
    ]);
    iVoted = false;
  } else {
    await prisma.$transaction([
      prisma.vote.create({
        data: { requestId, participantId: session.id },
      }),
      prisma.request.update({
        where: { id: requestId },
        data: { voteCount: { increment: 1 } },
      }),
    ]);
    iVoted = true;
  }

  const updated = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (updated.voteCount < 0) {
    await prisma.request.update({
      where: { id: requestId },
      data: { voteCount: 0 },
    });
    updated.voteCount = 0;
  }

  const fanout = [
    notifyPending(session.eventId),
    notifyRequests(session.eventId),
  ];
  // Live display reorders by votes when the queue changes.
  if (updated.status === STATUS.APPROVED) {
    fanout.push(notifyQueue(session.eventId));
  }
  await Promise.all(fanout);

  return NextResponse.json({
    request: toPublicRequest(updated, { iVoted }),
    iVoted,
  });
}
