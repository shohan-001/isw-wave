import { NextResponse } from "next/server";
import {
  getOwnerPanelPath,
  getStaffSession,
  ownerPasswordConfigured,
  setStaffSession,
  signStaffToken,
  staffAccountsExist,
  staffLogin,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/owner/login  { identifier, password }
export async function POST(req: Request) {
  if (!getOwnerPanelPath()) {
    return NextResponse.json(
      { error: "Ops console is not configured." },
      { status: 503 }
    );
  }

  const limit = checkRateLimit("owner-login", { limit: 8, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    identifier?: string;
    password?: string;
  };
  const identifier = (body.identifier || "").trim();
  const password = body.password || "";

  const result = await staffLogin(identifier, password);

  if (!result.ok) {
    await logActivity({
      type: "staff.login_failed",
      actorType: "system",
      actorLabel: identifier.slice(0, 120),
      details: `reason: ${result.reason}`,
    });
    const status = result.reason === "unconfigured" ? 503 : 401;
    const error =
      result.reason === "disabled"
        ? "This staff account is disabled."
        : result.reason === "unconfigured"
        ? "Ops console is not configured."
        : "Incorrect credentials.";
    return NextResponse.json({ error }, { status });
  }

  await setStaffSession(result.staff.id);
  const token = signStaffToken(result.staff.id);
  await logActivity({
    type: "staff.login",
    actorType: "staff",
    actorId: result.staff.id,
    actorLabel: result.staff.username,
    details: result.bootstrapped
      ? "bootstrap login via OWNER_PASSWORD (promoted to owner)"
      : `role: ${result.staff.role}`,
  });

  // `token` is for Flutter / Bearer clients; the cookie keeps the web ops console working.
  return NextResponse.json({ ok: true, staff: result.staff, token });
}

// GET /api/owner/login — session probe for the console shell.
export async function GET() {
  if (!getOwnerPanelPath()) {
    return NextResponse.json({ configured: false, ok: false }, { status: 503 });
  }
  const staff = await getStaffSession();
  return NextResponse.json({
    configured: true,
    ok: Boolean(staff),
    staff: staff ?? null,
    // Tells the login screen to explain the one-time bootstrap credential.
    bootstrapAvailable: !(await staffAccountsExist()) && ownerPasswordConfigured(),
  });
}
