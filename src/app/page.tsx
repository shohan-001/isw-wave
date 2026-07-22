import { redirect } from "next/navigation";
import { RequestClient } from "./RequestClient";
import { getEventById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Admins manage from /admin; the request page is for participants.
  if (user.role === "admin") redirect("/admin");

  const event = await getEventById(user.eventId);
  if (!event) redirect("/login");

  return (
    <RequestClient
      eventName={event.name}
      accentColor={event.accentColor}
      logoUrl={event.logoUrl}
      user={{
        role: "participant",
        id: user.id,
        displayName: user.displayName,
        eventId: user.eventId,
        isAdmin: false,
      }}
    />
  );
}
