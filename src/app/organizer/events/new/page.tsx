import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CreateEventForm } from "@/components/CreateEventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?mode=admin");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <CreateEventForm />
    </main>
  );
}
