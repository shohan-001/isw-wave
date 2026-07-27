import { redirect } from "next/navigation";
import { getEventById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Signed-in users keep their session destination; anonymous visitors see marketing.
  if (user) {
    if (user.role === "admin") redirect("/admin");
    if (user.eventSlug) redirect(`/e/${user.eventSlug}`);
    const event = await getEventById(user.eventId);
    if (event?.slug) redirect(`/e/${event.slug}`);
  }

  return <LandingPage />;
}
