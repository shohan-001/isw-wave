import { OrganizerSignupForm } from "@/components/OrganizerSignupForm";

export const dynamic = "force-dynamic";

export default function OrganizerSignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <OrganizerSignupForm />
    </main>
  );
}
