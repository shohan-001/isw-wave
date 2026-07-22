import { redirect } from "next/navigation";
import { getEventById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Legacy entry — participants are routed to /e/{slug}.
export default async function RequestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  if (user.eventSlug) redirect(`/e/${user.eventSlug}`);

  const event = await getEventById(user.eventId);
  if (event?.slug) redirect(`/e/${event.slug}`);

  redirect("/login");
}
