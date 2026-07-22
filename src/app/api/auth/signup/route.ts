import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import {
  hashPassword,
  signAuthToken,
  authCookieOptions,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/auth/signup — organizer account (User + Organization).
// Creates no event yet; redirect to /organizer/events/new after signup.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      email?: string;
      password?: string;
      orgName?: string;
    };

    const username = (body.username || "").trim().toLowerCase().slice(0, 32);
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const orgName = (body.orgName || `${username}'s events`).trim().slice(0, 80);

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const taken = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    if (taken) {
      return NextResponse.json(
        { error: "Username or email is already taken." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        isAdmin: true,
        organization: {
          create: { name: orgName },
        },
      },
      include: { organization: true },
    });

    // No event yet — login cookie without eventId; admin UI prompts create event.
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
      eventId: "",
      eventSlug: "",
      isAdmin: true,
    };
    return NextResponse.json({ user: authUser, organization: user.organization });
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: "Server error during signup. Try again." },
      { status: 500 }
    );
  }
}
