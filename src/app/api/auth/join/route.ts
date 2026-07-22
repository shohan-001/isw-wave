import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import {
  normalizeAccessCode,
  signAuthToken,
  authCookieOptions,
} from "@/lib/auth";
import { getEventBySlug } from "@/lib/queries";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/auth/join  { name, code?, slug?, deviceId }
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      code?: string;
      slug?: string;
      deviceId?: string;
    };

    const displayName = (body.name || "").trim().slice(0, 40);
    const code = normalizeAccessCode(body.code || "");
    const slug = (body.slug || "").trim().toLowerCase();
    const deviceId = (body.deviceId || "").trim().slice(0, 80);

    if (displayName.length < 2) {
      return NextResponse.json(
        { error: "Enter a name (at least 2 characters)." },
        { status: 400 }
      );
    }
    if (!code && !slug) {
      return NextResponse.json(
        { error: "Enter the event code or use an event link." },
        { status: 400 }
      );
    }
    if (deviceId.length < 8) {
      return NextResponse.json(
        { error: "Missing device id. Refresh and try again." },
        { status: 400 }
      );
    }

    const event = slug
      ? await getEventBySlug(slug)
      : await prisma.event.findUnique({ where: { accessCode: code } });

    if (!event) {
      return NextResponse.json(
        { error: slug ? "That event link is not valid." : "That event code is not valid." },
        { status: 404 }
      );
    }

    // Device lock is per-event: one display name per device per event.
    const priorOnDevice = await prisma.participant.findFirst({
      where: { eventId: event.id, deviceId },
      orderBy: { createdAt: "asc" },
      select: { displayName: true },
    });
    if (
      priorOnDevice &&
      priorOnDevice.displayName.toLowerCase() !== displayName.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `This device is locked to the name "${priorOnDevice.displayName}" for this event.`,
          lockedName: priorOnDevice.displayName,
        },
        { status: 409 }
      );
    }

    const lockedName = priorOnDevice?.displayName ?? displayName;

    const existing = await prisma.participant.findUnique({
      where: {
        eventId_deviceId: { eventId: event.id, deviceId },
      },
    });

    const participant =
      existing ??
      (await prisma.participant.create({
        data: {
          eventId: event.id,
          deviceId,
          displayName: lockedName,
        },
      }));

    cookies().set(
      AUTH_COOKIE,
      signAuthToken("participant", participant.id),
      authCookieOptions()
    );

    const authUser: AuthUser = {
      role: "participant",
      id: participant.id,
      displayName: participant.displayName,
      eventId: participant.eventId,
      eventSlug: event.slug,
      isAdmin: false,
    };
    return NextResponse.json({ user: authUser, eventSlug: event.slug });
  } catch (err) {
    console.error("[auth/join]", err);
    const message = err instanceof Error ? err.message : String(err);
    const hint = /401|unauthorized/i.test(message)
      ? "Database auth failed (Turso 401). Update TURSO_AUTH_TOKEN on Vercel and redeploy."
      : /TURSO_DATABASE_URL/i.test(message)
      ? message
      : "Server error while joining. Try again.";
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
