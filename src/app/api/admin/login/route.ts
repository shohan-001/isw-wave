import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/constants";
import {
  checkAdminPassword,
  adminCookieValue,
  adminCookieOptions,
  isAdmin,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/login — report whether the caller is already authenticated.
export async function GET() {
  return NextResponse.json({ authenticated: isAdmin() });
}

// POST /api/admin/login  { password }  — set the admin cookie on success.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkAdminPassword(body.password || "")) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  cookies().set(ADMIN_COOKIE, adminCookieValue(), adminCookieOptions());
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/login — log out.
export async function DELETE() {
  cookies().delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
