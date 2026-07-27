import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import { CreateEventForm } from "@/components/CreateEventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?mode=admin");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <BrandMark size={40} />
      <CreateEventForm />
    </main>
  );
}
