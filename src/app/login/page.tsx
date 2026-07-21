import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthClient } from "./AuthClient";

// Combined login / signup screen. Already-authenticated visitors are bounced to
// their home surface (admins → /admin, attendees → /). Same auth flow for both;
// isAdmin decides the destination.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.isAdmin ? "/admin" : "/");
  return <AuthClient />;
}
