import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthClient } from "./AuthClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { code?: string; mode?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    if (user.isAdmin) {
      redirect(user.eventId ? "/admin" : "/organizer/events/new");
    }
    redirect(user.eventSlug ? `/e/${user.eventSlug}` : "/");
  }
  return <AuthClient initialCode={(searchParams?.code || "").toUpperCase()} />;
}
