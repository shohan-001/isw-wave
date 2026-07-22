import { OrganizerSignupForm } from "@/components/OrganizerSignupForm";
import { BrandMark } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

export default function OrganizerSignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <BrandMark size={44} />
      <OrganizerSignupForm />
    </main>
  );
}
