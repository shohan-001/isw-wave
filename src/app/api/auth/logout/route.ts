import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/auth/logout — clear the auth cookie.
export async function POST() {
  cookies().delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
