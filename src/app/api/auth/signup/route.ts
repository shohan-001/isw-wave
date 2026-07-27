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
import {
  claimInviteCode,
  organizerInviteConfigured,
  releaseInviteCode,
  resolveInviteCode,
} from "@/lib/organizer-invite";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const INVITE_ERRORS: Record<string, { message: string; status: number }> = {
  unconfigured: {
    message:
      "Organizer signup is invite-only and no invite code is configured on this deployment.",
    status: 503,
  },
  revoked: {
    message: "That invite code has been revoked. Request to host an event instead.",
    status: 403,
  },
  expired: {
    message: "That invite code has expired. Request to host an event instead.",
    status: 403,
  },
  exhausted: {
    message:
      "That invite code has already been used its maximum number of times.",
    status: 403,
  },
  invalid: {
    message: "That invite code isn't valid. Request one to create events.",
    status: 403,
  },
};

// GET /api/auth/signup — whether self-serve signup is open on this deployment.
export async function GET() {
  return NextResponse.json({
    inviteRequired: true,
    open: await organizerInviteConfigured(),
  });
}

// POST /api/auth/signup — organizer account (User + Organization).
// Creates no event yet; redirect to /organizer/events/new after signup.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      email?: string;
      password?: string;
      orgName?: string;
      inviteCode?: string;
    };

    // Fail closed: with no usable code anywhere, nobody can self-serve.
    const invite = await resolveInviteCode(body.inviteCode || "");
    if (!invite.ok) {
      const detail = INVITE_ERRORS[invite.reason] || INVITE_ERRORS.invalid;
      return NextResponse.json(
        { error: detail.message },
        { status: detail.status }
      );
    }

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

    // Claim the seat before creating anything, so maxUses can't be oversubscribed.
    const claimedId = invite.source === "db" ? invite.id : "";
    if (claimedId && !(await claimInviteCode(claimedId))) {
      return NextResponse.json(
        { error: INVITE_ERRORS.exhausted.message },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          isAdmin: true,
          // Cap inherited from the code, so an invited organizer is bounded the
          // same way an approved one is. 0 = unlimited.
          eventLimit: invite.eventLimit,
          organization: {
            create: { name: orgName },
          },
        },
        include: { organization: true },
      });
    } catch (err) {
      if (claimedId) await releaseInviteCode(claimedId);
      throw err;
    }

    await logActivity({
      type: "invite.used",
      actorType: "organizer",
      actorId: user.id,
      actorLabel: user.username,
      targetType: "inviteCode",
      targetId: claimedId,
      details:
        invite.source === "db"
          ? `signed up with "${invite.label || "unlabelled"}" code, event limit ${
              invite.eventLimit || "unlimited"
            }`
          : "signed up with ORGANIZER_INVITE_CODE (env fallback)",
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
