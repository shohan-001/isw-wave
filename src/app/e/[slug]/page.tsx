import { notFound, redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { EventJoinClient } from "@/components/EventJoinClient";
import type { AuthUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug?.toLowerCase();
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const session = await getCurrentUser();
  if (session?.role === "admin") redirect("/admin");

  let initialUser: AuthUser | null = null;
  if (session?.role === "participant" && session.eventSlug === slug) {
    initialUser = {
      role: "participant",
      id: session.id,
      displayName: session.displayName,
      eventId: session.eventId,
      eventSlug: session.eventSlug,
      isAdmin: false,
    };
  }

  return (
    <EventJoinClient
      eventName={event.name}
      eventSlug={event.slug}
      accessCode={event.accessCode}
      accentColor={event.accentColor}
      logoUrl={event.logoUrl}
      initialUser={initialUser}
    />
  );
}
