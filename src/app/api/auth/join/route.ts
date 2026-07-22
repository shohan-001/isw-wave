import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import {
  normalizeAccessCode,
  signAuthToken,
  authCookieOptions,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

 // POST /api/auth/join  { name, code, deviceId }
 // Attendee join: no email/password. Looks up the event by access code, binds
 // the device to one display name, and sets a participant session cookie.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      code?: string;
      deviceId?: string;
    };

    const displayName = (body.name || "").trim().slice(0, 40);
    const code = normalizeAccessCode(body.code || "");
    const deviceId = (body.deviceId || "").trim().slice(0, 80);

    if (displayName.length < 2) {
      return NextResponse.json(
        { error: "Enter a name (at least 2 characters)." },
        { status: 400 }
      );
    }
    if (code.length < 4) {
      return NextResponse.json(
        { error: "Enter the event code shown on the screen." },
        { status: 400 }
      );
    }
    if (deviceId.length < 8) {
      return NextResponse.json(
        { error: "Missing device id. Refresh and try again." },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { accessCode: code },
    });
    if (!event) {
      return NextResponse.json(
        { error: "That event code is not valid." },
        { status: 404 }
      );
    }

    // Device lock: once a device has joined with a name, it can only use that
    // name again (any event). Re-joining the same event restores the row.
    const priorOnDevice = await prisma.participant.findFirst({
      where: { deviceId },
      orderBy: { createdAt: "asc" },
      select: { displayName: true },
    });
    if (
      priorOnDevice &&
      priorOnDevice.displayName.toLowerCase() !== displayName.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `This device is locked to the name "${priorOnDevice.displayName}". Use that name to join.`,
          lockedName: priorOnDevice.displayName,
        },
        { status: 409 }
      );
    }

    // Prefer the historically locked casing if they typed a different case.
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
      isAdmin: false,
    };
    return NextResponse.json({ user: authUser });
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
