import { NextResponse } from "next/server";
import { clearOwnerSession, requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearOwnerSession();
  return NextResponse.json({ ok: true });
}
