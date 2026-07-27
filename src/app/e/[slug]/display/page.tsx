import { notFound } from "next/navigation";
import { DisplayClient } from "@/app/display/DisplayClient";
import { getEventBySlug } from "@/lib/queries";
import { getPublicBaseUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export default async function EventDisplayPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug?.toLowerCase();
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const baseUrl = getPublicBaseUrl();
  const joinUrl = `${baseUrl}/e/${event.slug}`;

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
