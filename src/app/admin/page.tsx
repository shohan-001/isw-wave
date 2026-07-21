import { isAdmin } from "@/lib/admin";
import { AdminLogin } from "./AdminLogin";
import { AdminDashboard } from "./AdminDashboard";

// Admin dashboard (server shell). Gates on the admin cookie; unauthenticated
// visitors see the password prompt. This device is the one wired to venue
// audio — the active YouTube player lives inside AdminDashboard.
export const dynamic = "force-dynamic";

export default function AdminPage() {
  if (!isAdmin()) {
    return <AdminLogin />;
  }
  return <AdminDashboard />;
}
