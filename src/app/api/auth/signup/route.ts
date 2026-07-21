import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import { hashPassword, signAuthToken, authCookieOptions } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/auth/signup  { username, email, password }
// Creates a participant account (isAdmin defaults false) and logs them in by
// setting the signed auth cookie. No email verification in Phase 2 — just a
// securely hashed password. Admin accounts are seeded, not self-registered.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    email?: string;
    password?: string;
  };

  const username = (body.username || "").trim().slice(0, 40);
  const email = (body.email || "").trim().toLowerCase().slice(0, 120);
  const password = body.password || "";

  if (username.length < 2) {
    return NextResponse.json(
      { error: "Username must be at least 2 characters." },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // Uniqueness check up front for a friendly message (the DB unique constraint
  // is the real guard against races).
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (existing) {
    const which = existing.email === email ? "email" : "username";
    return NextResponse.json(
      { error: `That ${which} is already taken.` },
      { status: 409 }
    );
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await hashPassword(password),
        isAdmin: false,
      },
      select: { id: true, username: true, email: true, isAdmin: true },
    });
  } catch {
    // Unique constraint race — treat as taken.
    return NextResponse.json(
      { error: "That username or email is already taken." },
      { status: 409 }
    );
  }

  cookies().set(AUTH_COOKIE, signAuthToken(user.id), authCookieOptions());
  const authUser: AuthUser = user;
  return NextResponse.json({ user: authUser }, { status: 201 });
}
