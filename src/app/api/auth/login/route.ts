import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import {
  verifyPassword,
  signAuthToken,
  authCookieOptions,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

 // POST /api/auth/login  { identifier, password }
 // Admin-only password login. Attendees join via /api/auth/join instead.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      password?: string;
    };
    const identifier = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Enter your username/email and password." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        isAdmin: true,
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    const DUMMY =
      "$2a$10$CwTycUXWue0Thq9StjUM0uJ8kf3Yl6i7iVb5mYb6QYp3lqJr5v9K";
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
    if (!user || !ok) {
      return NextResponse.json(
        { error: "Incorrect username/email or password." },
        { status: 401 }
      );
    }

    const event = await prisma.event.findFirst({
      where: { adminId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json(
        {
          error:
            "No event is linked to this admin. Run npm run db:seed on the production database.",
        },
        { status: 500 }
      );
    }

    cookies().set(
      AUTH_COOKIE,
      signAuthToken("admin", user.id),
      authCookieOptions()
    );

    const authUser: AuthUser = {
      role: "admin",
      id: user.id,
      username: user.username,
      email: user.email,
      eventId: event.id,
      isAdmin: true,
    };
    return NextResponse.json({ user: authUser });
  } catch (err) {
    console.error("[auth/login]", err);
    const message = err instanceof Error ? err.message : String(err);
    const hint = /401|unauthorized/i.test(message)
      ? "Database auth failed (Turso 401). Update TURSO_AUTH_TOKEN on Vercel and redeploy."
      : /TURSO_DATABASE_URL/i.test(message)
      ? message
      : "Server error during login. Check database configuration.";
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
