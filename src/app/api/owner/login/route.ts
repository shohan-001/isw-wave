import { NextResponse } from "next/server";
import {
  getOwnerPanelPath,
  ownerPasswordConfigured,
  requireOwner,
  setOwnerSession,
  verifyOwnerPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/owner/login  { password }
export async function POST(req: Request) {
  if (!ownerPasswordConfigured() || !getOwnerPanelPath()) {
    return NextResponse.json({ error: "Owner console is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = body.password || "";
  if (!(await verifyOwnerPassword(password))) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }

  await setOwnerSession();
  return NextResponse.json({ ok: true });
}

// GET /api/owner/login — session probe
export async function GET() {
  if (!ownerPasswordConfigured() || !getOwnerPanelPath()) {
    return NextResponse.json({ configured: false, ok: false }, { status: 503 });
  }
  const ok = await requireOwner();
  return NextResponse.json({ configured: true, ok });
}
