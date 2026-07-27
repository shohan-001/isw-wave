import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { generateAccessCode, hashPassword, requireStaff } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/email";
import { createSetupToken, setupUrl } from "@/lib/password-setup";
import { getPublicBaseUrl } from "@/lib/public-url";
import { isValidSlug, slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const DEFAULT_EVENT_LIMIT = 3;

async function uniqueUsername(base: string): Promise<string> {
  const root = (slugify(base) || "organizer").replace(/-/g, "").slice(0, 24);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}${i + 1}`;
    const clash = await prisma.user.findUnique({ where: { username: candidate } });
    if (!clash) return candidate;
  }
  return `${root}${crypto.randomBytes(3).toString("hex")}`;
}

async function uniqueAccessCode(): Promise<string> {
  let code = generateAccessCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.event.findUnique({ where: { accessCode: code } });
    if (!clash) return code;
    code = generateAccessCode();
  }
  return code;
}

// POST /api/owner/event-requests/[id]
//   { action: "approve", slug?, eventName?, eventLimit?, note? }
//   { action: "reject", note }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.eventRequest.findUnique({
    where: { id: params.id },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `This request was already ${request.status}.` },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    slug?: string;
    eventName?: string;
    eventLimit?: number;
    note?: string;
  };
  const note = (body.note || "").trim().slice(0, 500);

  if (body.action === "reject") {
    await prisma.eventRequest.update({
      where: { id: request.id },
      data: {
        status: "rejected",
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });

    await logActivity({
      type: "request.rejected",
      actorType: "staff",
      actorId: staff.id,
      actorLabel: staff.username,
      targetType: "eventRequest",
      targetId: request.id,
      details: `${request.eventName}${note ? ` — ${note}` : ""}`,
    });

    const mail = await sendEmail({
      to: request.contactEmail,
      subject: `About your request to host ${request.eventName}`,
      heading: "We can't take this one on",
      body: [
        `Hi ${request.contactName} — thanks for your interest in running "${request.eventName}" on ISW Wave.`,
        note ||
          "We aren't able to approve this request right now. Capacity is limited while the platform is invite-only.",
        "If your plans change or you'd like to discuss it, just reply to this email.",
      ],
    });

    return NextResponse.json({ ok: true, emailSent: mail.sent });
  }

  if (body.action !== "approve") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const eventName = (body.eventName || request.eventName).trim().slice(0, 80);
  const slug = slugify(body.slug || request.eventName);
  const eventLimit = Math.max(
    1,
    Math.min(50, Number(body.eventLimit) || DEFAULT_EVENT_LIMIT)
  );

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      {
        error:
          "URL slug must be 2–48 characters: lowercase letters, numbers, and hyphens.",
      },
      { status: 400 }
    );
  }
  if (await prisma.event.findUnique({ where: { slug } })) {
    return NextResponse.json(
      { error: "That URL slug is already taken. Pick another." },
      { status: 409 }
    );
  }

  const emailTaken = await prisma.user.findUnique({
    where: { email: request.contactEmail },
    select: { id: true },
  });
  if (emailTaken) {
    return NextResponse.json(
      {
        error:
          "An account already uses that email. Add the event from the Organizers tab instead.",
      },
      { status: 409 }
    );
  }

  const username = await uniqueUsername(request.contactName || request.orgName);
  const accessCode = await uniqueAccessCode();
  // Placeholder hash: the account is unusable until the setup link is consumed.
  const placeholderHash = await hashPassword(
    crypto.randomBytes(24).toString("base64url")
  );

  const { user, event } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        email: request.contactEmail,
        passwordHash: placeholderHash,
        isAdmin: true,
        eventLimit,
      },
    });

    const org = await tx.organization.create({
      data: { name: request.orgName, ownerId: user.id },
    });

    const event = await tx.event.create({
      data: {
        name: eventName,
        slug,
        accessCode,
        organizationId: org.id,
        adminId: user.id,
      },
    });

    await tx.eventRequest.update({
      where: { id: request.id },
      data: {
        status: "approved",
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewNote: note,
        createdUserId: user.id,
        createdEventId: event.id,
      },
    });

    return { user, event };
  });

  const rawToken = await createSetupToken(user.id);
  const link = setupUrl(rawToken);

  await logActivity({
    type: "request.approved",
    actorType: "staff",
    actorId: staff.id,
    actorLabel: staff.username,
    eventId: event.id,
    targetType: "eventRequest",
    targetId: request.id,
    details: `${eventName} → /e/${slug}, organizer ${username}, limit ${eventLimit}`,
  });

  const startsAt = request.startsAt.toISOString().replace("T", " ").slice(0, 16);
  const mail = await sendEmail({
    to: request.contactEmail,
    subject: `${eventName} is approved — set your password`,
    heading: "Your event is approved",
    body: [
      `Hi ${request.contactName} — "${eventName}" is ready on ISW Wave.`,
      `Your organizer username is ${username}. Use the button below to set your password, then sign in to your control room. The link works once and expires in 72 hours.`,
      `Guests join at ${getPublicBaseUrl()}/e/${slug} or with access code ${accessCode}.`,
      `We have you starting ${startsAt}${
        request.timezone ? ` (${request.timezone})` : ""
      }. Reply to this email if that changes.`,
      "One thing to know: only the laptop running the admin page plays audio. The hall display screen is silent by design.",
    ],
    cta: { label: "Set your password", url: link },
  });

  return NextResponse.json({
    ok: true,
    emailSent: mail.sent,
    // Returned so the console can show a copy-ready handover when email is off.
    organizer: {
      username,
      email: request.contactEmail,
      setupUrl: link,
      eventUrl: `${getPublicBaseUrl()}/e/${slug}`,
      accessCode,
      eventLimit,
    },
  });
}
