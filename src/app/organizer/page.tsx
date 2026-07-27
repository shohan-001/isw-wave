import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import { OrganizerEventsList } from "@/components/OrganizerEventsList";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?mode=admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <div className="mb-8">
        <BrandMark size={36} />
      </div>
      <h1 className="font-display mb-2 text-3xl font-bold text-white">
        Your events
      </h1>
      <p className="mb-8 text-sm text-white/45">
        Each event is fully isolated — its own queue, settings, and theme.
        {/* Phase 6: native admin apps are out of scope; responsive web admin only. */}
      </p>
      <OrganizerEventsList activeEventId={user.eventId || undefined} />
    </main>
  );
}
