import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BrandMark } from "@/components/BrandMark";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your request · ISW Wave",
  robots: { index: false, follow: false },
};

const STATUS_COPY = {
  pending: {
    label: "In review",
    tone: "border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
    heading: "We're reviewing your event",
    body: "Every event is checked by hand before it goes live, usually within a day or two. You'll get an email with a link to set your password as soon as it's approved.",
  },
  approved: {
    label: "Approved",
    tone: "border-wave/30 bg-wave/[0.08] text-wave-400",
    heading: "Your event is approved",
    body: "Check your email for the link to set your password. Once that's done you can sign in and open your control room.",
  },
  rejected: {
    label: "Not approved",
    tone: "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
    heading: "We couldn't take this one on",
    body: "Capacity is limited while the platform is invite-only. If your plans change, get in touch and we can look again.",
  },
} as const;

export default async function HostStatusPage({
  params,
}: {
  params: { token: string };
}) {
  const request = await prisma.eventRequest.findUnique({
    where: { publicToken: params.token },
    select: {
      contactName: true,
      eventName: true,
      orgName: true,
      startsAt: true,
      timezone: true,
      status: true,
      reviewNote: true,
      createdAt: true,
    },
  });

  if (!request) notFound();

  const copy =
    STATUS_COPY[request.status as keyof typeof STATUS_COPY] ??
    STATUS_COPY.pending;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#07080c]">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-6 sm:px-8">
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

      <section className="mx-auto w-full max-w-2xl px-5 pb-20 sm:px-8">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${copy.tone}`}
        >
          {copy.label}
        </span>

        <h1 className="mt-5 font-display text-3xl font-bold text-white">
          {copy.heading}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">
          {copy.body}
        </p>

        {request.reviewNote ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/60">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Note from the team
            </span>
            {request.reviewNote}
          </p>
        ) : null}

        <dl className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          <Row label="Event" value={request.eventName} />
          <Row label="Organization" value={request.orgName} />
          <Row label="Contact" value={request.contactName} />
          <Row
            label="Starts"
            value={`${request.startsAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 16)}${request.timezone ? ` · ${request.timezone}` : ""}`}
          />
          <Row
            label="Submitted"
            value={request.createdAt.toISOString().slice(0, 10)}
          />
        </dl>

        <p className="mt-8 text-xs text-white/30">
          Questions? Email{" "}
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="text-white/50 hover:text-wave-400"
          >
            {SITE.contactEmail}
          </a>
          . Bookmark this page — it always shows the current status.
        </p>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
        {label}
      </dt>
      <dd className="text-sm text-white/75">{value}</dd>
    </div>
  );
}
