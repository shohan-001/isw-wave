import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me — the current logged-in user, or { user: null }.
// The client uses this to bootstrap auth state and gate the request page.
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
