import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ user: null });

  const user: AuthUser =
    session.role === "admin"
      ? {
          role: "admin",
          id: session.id,
          username: session.username,
          email: session.email,
          eventId: session.eventId,
          isAdmin: true,
        }
      : {
          role: "participant",
          id: session.id,
          displayName: session.displayName,
          eventId: session.eventId,
          isAdmin: false,
        };

  return NextResponse.json({ user });
}
