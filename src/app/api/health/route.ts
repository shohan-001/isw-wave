import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDbConfig } from "@/lib/db-config";

export const dynamic = "force-dynamic";

 // GET /api/health — safe DB connectivity check for diagnosing Vercel + Turso.
export async function GET() {
  let remote = false;
  let configError: string | null = null;
  try {
    remote = resolveDbConfig().remote;
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }

  if (configError) {
    return NextResponse.json(
      { ok: false, remote, stage: "config", error: configError },
      { status: 500 }
    );
  }

  try {
    // Lightweight round-trip that works on empty or seeded DBs.
    await prisma.$queryRaw`SELECT 1`;
    const users = await prisma.user.count();
    const events = await prisma.event.count();
    return NextResponse.json({
      ok: true,
      remote,
      users,
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unauthorized = /401|unauthorized|auth/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        remote,
        stage: "query",
        error: unauthorized
          ? "Turso rejected the auth token (401). Rotate TURSO_AUTH_TOKEN in Vercel to match a fresh `turso db tokens create` value, then redeploy."
          : message.slice(0, 300),
      },
      { status: 500 }
    );
  }
}
