import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { HostRequestForm } from "@/components/landing/HostRequestForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Request to host an event · ISW Wave",
  description:
    "Apply to run live song requests at your event. Tell us about the event and we'll review it by hand.",
};

export default function HostPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(120% 70% at 50% 0%, black 20%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 70% at 50% 0%, black 20%, transparent 75%)",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" aria-label="ISW Wave home">
          <BrandMark size={28} />
        </Link>
        <Link
          href="/login?mode=admin"
          className="text-xs font-semibold text-white/45 transition hover:text-wave-400"
        >
          Organizer sign in
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
          For organizers
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
          Request to host an event
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">
          Every event shares one YouTube search quota, so each one is reviewed by
          hand before it goes live. Tell us what you&apos;re running and when.
          Approved organizers get a link to set their password, their own join
          code, and a control room.
        </p>

        <div className="mt-10">
          <HostRequestForm />
        </div>
      </section>
    </main>
  );
}
