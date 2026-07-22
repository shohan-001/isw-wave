import { DisplayClient } from "./DisplayClient";
import { normalizeAccessCode } from "@/lib/auth";
import { getEventByAccessCode, getEventById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  searchParams,
}: {
  searchParams?: { code?: string; eventId?: string };
}) {
  const baseUrl = getPublicBaseUrl();

  const accessCode = searchParams?.code
    ? normalizeAccessCode(searchParams.code)
    : "";
  let eventId = searchParams?.eventId || "";

  if (!accessCode && !eventId) {
    const session = await getCurrentUser();
    if (session?.role === "admin") {
      eventId = session.eventId;
    }
  }

  const event = accessCode
    ? await getEventByAccessCode(accessCode)
    : eventId
    ? await getEventById(eventId)
    : null;

  if (!event) {
    // No event resolved — send organizers to login / control room.
    redirect("/login?mode=admin");
  }

  const joinUrl = `${baseUrl}/login?code=${encodeURIComponent(event.accessCode)}`;

  return (
    <DisplayClient
      requestUrl={joinUrl}
      accessCode={event.accessCode}
      eventName={event.name}
      eventId={event.id}
      accentColor={event.accentColor}
      logoUrl={event.logoUrl}
      displayMode={event.displayMode === "minimal" ? "minimal" : "full"}
    />
  );
}
