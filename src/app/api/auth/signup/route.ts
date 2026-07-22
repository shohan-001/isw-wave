import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

 // Attendee signup was removed. Guests join with name + event access code.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Accounts are no longer created this way. Join with your name and the event code shown on screen.",
    },
    { status: 410 }
  );
}
