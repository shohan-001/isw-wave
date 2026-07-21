import { redirect } from "next/navigation";
import { RequestClient } from "./RequestClient";
import { getEvent } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

// Public request page (server shell). Phase 2: requires a logged-in account.
// Unauthenticated visitors go to /login; admins land here too (they can request
// like anyone) but /admin is their control surface. We read the event name and
// current user here so branding + identity are present on first paint.
export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent();
  return <RequestClient eventName={event.name} user={user} />;
}
