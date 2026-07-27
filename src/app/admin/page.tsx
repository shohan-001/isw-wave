import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/queries";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?mode=admin");
  if (user.role !== "admin") redirect("/");

  if (!user.eventId) redirect("/organizer/events/new");

  const event = await getEventById(user.eventId);
  if (!event) redirect("/organizer/events/new");

  return (
    <AdminDashboard
      eventId={event.id}
      eventSlug={event.slug}
      initialAccent={event.accentColor}
    />
  );
}
