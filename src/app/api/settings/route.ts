import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAccessCode, requireAdmin } from "@/lib/auth";
import type { Settings } from "@/lib/types";
import { notifySettings } from "@/lib/realtime";
import {
  DEFAULT_ACCENT,
  normalizeHex,
  type DisplayMode,
} from "@/lib/theme";

export const dynamic = "force-dynamic";

function toSettings(event: {
  id: string;
  name: string;
  requestLimit: number;
  approvalMode: string;
  accessCode: string;
  maxSongSeconds: number;
  blockedKeywords: string;
  autoModMode: string;
  accentColor: string;
  logoUrl: string;
  displayMode: string;
}): Settings {
  return {
    eventId: event.id,
    eventName: event.name,
    requestLimit: event.requestLimit,
    approvalMode: event.approvalMode as Settings["approvalMode"],
    accessCode: event.accessCode,
    maxSongSeconds: event.maxSongSeconds,
    blockedKeywords: event.blockedKeywords,
    autoModMode: event.autoModMode === "flag" ? "flag" : "reject",
    accentColor: normalizeHex(event.accentColor) || DEFAULT_ACCENT,
    logoUrl: event.logoUrl || "",
    displayMode: event.displayMode === "minimal" ? "minimal" : "full",
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: admin.eventId },
  });
  return NextResponse.json({ settings: toSettings(event) });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Settings> & {
    regenerateCode?: boolean;
  };

  const data: {
    requestLimit?: number;
    approvalMode?: string;
    accessCode?: string;
    name?: string;
    maxSongSeconds?: number;
    blockedKeywords?: string;
    autoModMode?: string;
    accentColor?: string;
    logoUrl?: string;
    displayMode?: DisplayMode;
  } = {};

  if (typeof body.requestLimit === "number") {
    data.requestLimit = Math.min(20, Math.max(1, Math.floor(body.requestLimit)));
  }
  if (body.approvalMode === "manual" || body.approvalMode === "auto") {
    data.approvalMode = body.approvalMode;
  }
  if (typeof body.eventName === "string" && body.eventName.trim()) {
    data.name = body.eventName.trim().slice(0, 80);
  }
  if (typeof body.maxSongSeconds === "number") {
    data.maxSongSeconds = Math.min(
      3600,
      Math.max(0, Math.floor(body.maxSongSeconds))
    );
  }
  if (typeof body.blockedKeywords === "string") {
    data.blockedKeywords = body.blockedKeywords.slice(0, 2000);
  }
  if (body.autoModMode === "reject" || body.autoModMode === "flag") {
    data.autoModMode = body.autoModMode;
  }
  if (typeof body.accentColor === "string") {
    const hex = normalizeHex(body.accentColor);
    if (!hex) {
      return NextResponse.json(
        { error: "Accent color must be a 6-digit hex like #e0338f." },
        { status: 400 }
      );
    }
    data.accentColor = hex;
  }
  if (typeof body.logoUrl === "string") {
    data.logoUrl = body.logoUrl.trim().slice(0, 500);
  }
  if (body.displayMode === "minimal" || body.displayMode === "full") {
    data.displayMode = body.displayMode;
  }
  if (body.regenerateCode) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateAccessCode();
      const clash = await prisma.event.findUnique({
        where: { accessCode: candidate },
      });
      if (!clash) {
        data.accessCode = candidate;
        break;
      }
    }
    if (!data.accessCode) {
      return NextResponse.json(
        { error: "Could not generate a unique code. Try again." },
        { status: 500 }
      );
    }
  }

  const event = await prisma.event.update({
    where: { id: admin.eventId },
    data,
  });
  await notifySettings(admin.eventId);
  return NextResponse.json({ settings: toSettings(event) });
}
