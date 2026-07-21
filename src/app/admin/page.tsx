import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminDashboard } from "./AdminDashboard";

// Admin dashboard (server shell). Phase 2: gated by the logged-in user's admin
// role, not a shared password. Non-admins are sent to their request page;
// logged-out visitors go to /login. This device is the one wired to venue
// audio — the active YouTube player lives inside AdminDashboard.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return <AdminDashboard />;
}
