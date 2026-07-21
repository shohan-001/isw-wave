import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import {
  getSessionId,
  newSessionId,
  signSessionId,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/session
// Returns the current session id, issuing a fresh signed cookie if none exists.
// The client mirrors the returned id into localStorage.
export async function GET() {
  let id = getSessionId();
  const res = NextResponse.json({ sessionId: id ?? "" });
  if (!id) {
    id = newSessionId();
    res.cookies.set(SESSION_COOKIE, signSessionId(id), sessionCookieOptions());
    return NextResponse.json({ sessionId: id }, { headers: res.headers });
  }
  return res;
}

// POST /api/session  { sessionId }
// In-app browsers often drop cookies when the mini-browser closes. On load, the
// client reads its mirrored id from localStorage and posts it here so we can
// re-issue the signed cookie from it. We only trust an id that is a plausible
// UUID (the client can't forge a *valid signature*, but the cookie is what we
// verify against later — re-signing a client-supplied id is acceptable for
// Phase 1's soft identity: worst case someone impersonates their own prior id).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const incoming = body.sessionId;
  const uuidLike = /^[0-9a-f-]{16,64}$/i;

  const existing = getSessionId();
  const id = existing || (incoming && uuidLike.test(incoming) ? incoming : newSessionId());

  cookies().set(SESSION_COOKIE, signSessionId(id), sessionCookieOptions());
  return NextResponse.json({ sessionId: id });
}
