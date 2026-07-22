import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/queries";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const event = await getEventById(user.eventId);
  if (!event) redirect("/login");

  return (
    <AdminDashboard
      eventId={event.id}
      initialAccessCode={event.accessCode}
      initialAccent={event.accentColor}
    />
  );
}
