import { NextResponse } from "next/server";
import { consumeSetupToken, inspectSetupToken } from "@/lib/password-setup";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  unknown: "This setup link isn't valid.",
  used: "This setup link was already used. Sign in, or ask for a new link.",
  expired: "This setup link has expired. Ask for a new one.",
};

// GET /api/auth/set-password?token= — check a link before showing the form.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const state = await inspectSetupToken(token);
  if (!state.valid) {
    return NextResponse.json(
      { valid: false, error: REASONS[state.reason] },
      { status: 400 }
    );
  }
  return NextResponse.json({ valid: true, username: state.username });
}

// POST /api/auth/set-password  { token, password }
export async function POST(req: Request) {
  const limit = checkRateLimit("set-password", { limit: 10, windowMs: 600_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const result = await consumeSetupToken(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: REASONS[result.reason] }, { status: 400 });
  }

  await logActivity({
    type: "organizer.password_set",
    actorType: "organizer",
    actorId: result.userId,
    targetType: "organizer",
    targetId: result.userId,
    details: "password set via one-time setup link",
  });

  return NextResponse.json({ ok: true });
}
