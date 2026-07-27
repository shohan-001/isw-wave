import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { emailConfigured, sendEmail } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const MAX_DETAILS = 1500;

// POST /api/event-requests — public "request to host an event" form.
export async function POST(req: Request) {
  // Public form on a page linked from a portfolio: bots will find it.
  const limit = checkRateLimit("event-request", { limit: 3, windowMs: 3_600_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You've already sent a few requests. Try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Honeypot: a hidden field only an automated filler would populate.
  if (String(body.website || "").trim()) {
    return NextResponse.json({ ok: true, token: "" });
  }

  const str = (key: string, max: number) =>
    String(body[key] ?? "")
      .trim()
      .slice(0, max);

  const contactName = str("contactName", 80);
  const contactEmail = str("contactEmail", 120).toLowerCase();
  const contactPhone = str("contactPhone", 40);
  const orgName = str("orgName", 100);
  const eventName = str("eventName", 100);
  const eventDetails = str("eventDetails", MAX_DETAILS);
  const venue = str("venue", 120);
  const timezone = str("timezone", 60);
  const startsAtRaw = str("startsAt", 40);
  const expectedGuests = Math.max(
    0,
    Math.min(100_000, Number(body.expectedGuests) || 0)
  );

  if (contactName.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (orgName.length < 2) {
    return NextResponse.json(
      { error: "Tell us which group or company this is for." },
      { status: 400 }
    );
  }
  if (eventName.length < 2) {
    return NextResponse.json({ error: "Enter the event name." }, { status: 400 });
  }
  if (eventDetails.length < 20) {
    return NextResponse.json(
      { error: "Describe the event in a little more detail (20+ characters)." },
      { status: 400 }
    );
  }

  const startsAt = new Date(startsAtRaw);
  if (!startsAtRaw || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json(
      { error: "Pick the date and time the event starts." },
      { status: 400 }
    );
  }

  // A pending duplicate is almost always a double submit or an impatient resend.
  const openDuplicate = await prisma.eventRequest.findFirst({
    where: { contactEmail, status: "pending" },
    select: { publicToken: true },
  });
  if (openDuplicate) {
    return NextResponse.json({
      ok: true,
      token: openDuplicate.publicToken,
      duplicate: true,
    });
  }

  const h = headers();
  const created = await prisma.eventRequest.create({
    data: {
      publicToken: crypto.randomBytes(16).toString("base64url"),
      contactName,
      contactEmail,
      contactPhone,
      orgName,
      eventName,
      eventDetails,
      venue,
      expectedGuests,
      startsAt,
      timezone,
      ip: (h.get("x-forwarded-for") || "").split(",")[0]?.trim().slice(0, 64) || "",
      userAgent: (h.get("user-agent") || "").slice(0, 300),
    },
  });

  await logActivity({
    type: "request.submitted",
    actorType: "organizer",
    actorLabel: contactName,
    targetType: "eventRequest",
    targetId: created.id,
    details: `${eventName} for ${orgName}`,
  });

  if (emailConfigured()) {
    await sendEmail({
      to: contactEmail,
      subject: `We got your request to host ${eventName}`,
      heading: "Request received",
      body: [
        `Thanks ${contactName} — your request to host "${eventName}" is in the review queue.`,
        "We review each event by hand, usually within a day or two. You'll get an email as soon as it's approved, with a link to set your password and open your control room.",
        "You can check the status of your request any time using the link below.",
      ],
      cta: {
        label: "Check request status",
        url: `${getPublicBaseUrl()}/host/${created.publicToken}`,
      },
    });
  }

  return NextResponse.json({ ok: true, token: created.publicToken });
}
