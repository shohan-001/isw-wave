import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/constants";
import { verifyPassword, signAuthToken, authCookieOptions } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/auth/login  { identifier, password }
// `identifier` is a username OR email. Same flow for attendees and admins —
// isAdmin on the returned user drives client-side routing to /admin vs /.
export async function POST(req: Request) {
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
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  // Verify against the stored hash. When no user matches, still run a bcrypt
  // compare against a dummy hash so the response time doesn't reveal whether
  // the account exists (basic user-enumeration mitigation).
  const DUMMY = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8kf3Yl6i7iVb5mYb6QYp3lqJr5v9K";
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) {
    return NextResponse.json(
      { error: "Incorrect username/email or password." },
      { status: 401 }
    );
  }

  cookies().set(AUTH_COOKIE, signAuthToken(user.id), authCookieOptions());
  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
  };
  return NextResponse.json({ user: authUser });
}
