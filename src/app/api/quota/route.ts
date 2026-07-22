import { NextResponse } from "next/server";
import { getQuotaUsage } from "@/lib/youtube-quota";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/quota — daily YouTube API usage (admin only).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const quota = await getQuotaUsage();
  return NextResponse.json({ quota });
}
